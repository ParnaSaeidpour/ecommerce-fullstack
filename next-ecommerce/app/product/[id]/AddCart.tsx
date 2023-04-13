'use client'


import { useCartStore } from "@/store"
import { AddCartType } from "@/types/AddCartType"




export default function AddCart({name,id,image,price,quantity}:AddCartType){
    const cartStore= useCartStore()
    
    
    return(
        <>
            <button
             onClick={()=>cartStore.addProduct({id,image,price,quantity,name})} className="my-4 btn btn-primary"> Add to cart </button>
        </>
    )
}