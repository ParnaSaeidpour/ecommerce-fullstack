// Server-side pricing for checkout.
// The client only tells us WHICH products and HOW MANY. Prices, names and
// images always come from Stripe, so a modified request cannot change the amount.

export const MAX_QUANTITY_PER_ITEM = 99

export class CartValidationError extends Error {}

export type CartRequestItem = {
  id: string
  quantity: number
}

// Trusted product data, looked up on the server (from Stripe in production)
export type ProductInfo = {
  name: string
  description: string | null
  image: string
  unitAmount: number // smallest currency unit, e.g. cents
}

export type PricedLineItem = ProductInfo & {
  id: string
  quantity: number
}

export type ProductLookup = (productId: string) => Promise<ProductInfo | null>

// Validate the untrusted request body and keep only id + quantity
export const parseCartItems = (items: unknown): CartRequestItem[] => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CartValidationError("Cart is empty")
  }

  const quantities = new Map<string, number>()
  for (const item of items) {
    const id = (item as { id?: unknown })?.id
    const quantity = (item as { quantity?: unknown })?.quantity

    if (typeof id !== "string" || id.trim() === "") {
      throw new CartValidationError("Every cart item needs a product id")
    }
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY_PER_ITEM
    ) {
      throw new CartValidationError(`Invalid quantity for product ${id}`)
    }

    // Merge duplicates so the same product can't bypass the quantity limit
    const total = (quantities.get(id) ?? 0) + quantity
    if (total > MAX_QUANTITY_PER_ITEM) {
      throw new CartValidationError(`Invalid quantity for product ${id}`)
    }
    quantities.set(id, total)
  }

  return Array.from(quantities, ([id, quantity]) => ({ id, quantity }))
}

// Attach trusted product data to each cart item
export const priceCartItems = async (
  items: CartRequestItem[],
  lookupProduct: ProductLookup
): Promise<PricedLineItem[]> => {
  return Promise.all(
    items.map(async (item) => {
      const product = await lookupProduct(item.id)
      if (!product) {
        throw new CartValidationError(`Unknown product ${item.id}`)
      }
      return { ...product, id: item.id, quantity: item.quantity }
    })
  )
}

export const calculateOrderAmount = (items: PricedLineItem[]): number => {
  return items.reduce((total, item) => total + item.unitAmount * item.quantity, 0)
}
