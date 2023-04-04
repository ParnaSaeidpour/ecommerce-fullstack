type Params={
    id:string
}

type SearchParams={
    name:string,
    image:string,
    price:number | null
    id:string
    description:string |null
    features:string
}



export type SearchParamTypes={
    params:Params,
    searchParams: SearchParams
}


