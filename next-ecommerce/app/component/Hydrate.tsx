'use client'

import { useThemStore } from "@/store"
import { ReactNode, useEffect,useState } from "react"


export default function Hydrate({children}:{children:ReactNode}){

    const [isHydrated, setIsHydrated]= useState(false)
    const themeStore= useThemStore()
    

    //wait till next.js rehydration completes

    useEffect(()=>{
        setIsHydrated(true)
    },[])

    return(
        <>
        {isHydrated ?( <body className="mx-4 lg:px-48"  data-theme ={themeStore.mode}>{children}</body>) : (<body></body>)}
        
        
        </>

    )
}