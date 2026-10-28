'use client'


import {loadStripe,StripeElementsOptions} from '@stripe/stripe-js';
import {Elements} from '@stripe/react-stripe-js'
import { useCartStore } from '@/store';
import { useState,useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CheckoutForm from './checkoutForm'
import OrderAnimation from './OrderAnimation';
import {motion} from 'framer-motion'




// when we want use env from servet to cliend we add next_public befor 

const stripePromise=loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function Checkout(){
    const cartStore= useCartStore()
    const router =useRouter()
    const[clientSecret, setClientSecret]= useState("")
    const[error, setError]= useState("")



    useEffect(()=>{

        fetch('/api/create-payment-intent',{
            method:"POST",
            headers:{'Content-Type': 'application/json'},
            body:JSON.stringify({
                items:cartStore.cart,
                payment_intent_id:cartStore.paymentIntent,
            })
        }).then((res)=>{
            if(res.status ===403){
                router.push('api/auth/signin')
                return null
            }
            return res.json()
        }).then((data)=>{
           if(!data) return
           if(!data.paymentIntent){
               setError(data.message || "Could not start checkout")
               return
           }
           setClientSecret(data.paymentIntent.client_secret)
           cartStore.setPaymentIntent(data.paymentIntent.id)
        }).catch(()=>setError("Could not start checkout"))


    },[])


    const options: StripeElementsOptions={
        clientSecret,
        appearance: {
            theme:'night',
            labels:'floating',
        }
    }

    return(
        <div>
            {error && <p className="text-error py-4">{error}</p>}
            {!clientSecret && !error && <OrderAnimation/>}
            {clientSecret &&(
                <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                    <Elements options={options} stripe={stripePromise}>
                       <CheckoutForm clientSecret={clientSecret}/>
                    </Elements>
                </motion.div>
            )}
        </div>
    )



}




