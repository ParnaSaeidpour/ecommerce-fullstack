export type ProductType={
    name:string,
    image:string,
    price:number | null
    id:string
    quantity?:number | 1
    description:string | null
    metadata: MetadataType

}


type MetadataType={
    features:string
}