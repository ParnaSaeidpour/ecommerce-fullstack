import Stripe from "stripe";
import { NextApiRequest,NextApiResponse } from "next";
import {options} from "./auth/[...nextauth]"
import { getServerSession } from "next-auth/next"
import {prisma} from '@/util/prisma'
import {
  CartValidationError,
  ProductInfo,
  calculateOrderAmount,
  parseCartItems,
  priceCartItems,
} from "@/util/pricing"



const stripe= new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion:'2022-11-15'
  })


  // Look up the real product data in Stripe (same source as the product list on the home page)
  const lookupProduct=async(productId:string):Promise<ProductInfo|null>=>{
    try{
      const product=await stripe.products.retrieve(productId)
      if(!product.active) return null

      const prices=await stripe.prices.list({product:product.id, active:true})
      const unitAmount=prices.data[0]?.unit_amount
      if(unitAmount==null) return null

      return{
        name:product.name,
        description:product.description,
        image:product.images[0] ?? "",
        unitAmount,
      }
    }catch(err){
      if(err instanceof Stripe.errors.StripeInvalidRequestError) return null
      throw err
    }
  }

  export default async function handler(req:NextApiRequest,res:NextApiResponse) {

    if(req.method!=="POST"){
      res.setHeader("Allow","POST")
      res.status(405).json({message:"Method Not Allowed"})
      return
    }

    //Get user

    const userSession= await getServerSession(req,res,options)

    if (!userSession?.user) {
        res.status(403).json({ message: "Not Logged In" });
        return
      }

      //Extract the data from the body. Only product ids and quantities are trusted from the client.

      const {items,payment_intent_id}=req.body

      let lineItems
      try{
        lineItems=await priceCartItems(parseCartItems(items),lookupProduct)
      }catch(err){
        if(err instanceof CartValidationError){
          res.status(400).json({message:err.message})
          return
        }
        throw err
      }

      const amount=calculateOrderAmount(lineItems)
      const products=lineItems.map((item)=>({
        name:item.name,
        description:item.description,
        price:item.unitAmount,
        image:item.image,
        quantity:item.quantity
      }))


      // Create the order data

      const orderData={
        user:{connect:{id:userSession.user.id}},
        amount,
        currency:'usd',
        status:'pending',
        paymentIntentID:'',
        products:{
          create:products
        }
      }

      // fetch the order with products id, only if it is a pending order of the logged in user.
      // A stale or foreign payment intent id is ignored and a new order is created instead.

      const existing_order= payment_intent_id ? await prisma.order.findFirst({
        where:{paymentIntentID:payment_intent_id, userId:userSession.user.id, status:'pending'},
        include:{products:true}
      }) : null

      if (existing_order){
        const updated_intent= await stripe.paymentIntents.update(
          existing_order.paymentIntentID as string,
          {amount}
        )

        // Update Existing Order

        await prisma.order.update({
          where:{id:existing_order.id},
          data:{
            amount,
            products:{
              deleteMany:{},
              create:products
            }
          }
        })
        res.status(200).json({paymentIntent: updated_intent})
        return
      }else{
        //Create a new order with prisam
        const paymentIntent =await stripe.paymentIntents.create({
          amount,
          currency:"usd",
          automatic_payment_methods:{enabled:true},
        })

        orderData.paymentIntentID=paymentIntent.id

        await prisma.order.create({
          data:orderData
        })
        res.status(200).json({paymentIntent})
      }

    }
