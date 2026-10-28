import { describe, expect, it } from "vitest"
import {
  CartValidationError,
  MAX_QUANTITY_PER_ITEM,
  ProductInfo,
  calculateOrderAmount,
  parseCartItems,
  priceCartItems,
} from "@/util/pricing"

const catalog: Record<string, ProductInfo> = {
  prod_mug: { name: "Mug", description: "Coffee mug", image: "mug.png", unitAmount: 1500 },
  prod_tee: { name: "T-shirt", description: null, image: "tee.png", unitAmount: 2500 },
}
const lookup = async (id: string) => catalog[id] ?? null

describe("parseCartItems", () => {
  it("keeps only id and quantity from the client", () => {
    const items = parseCartItems([
      { id: "prod_mug", quantity: 2, price: 1, name: "Free mug", image: "x.png" },
    ])
    expect(items).toEqual([{ id: "prod_mug", quantity: 2 }])
  })

  it("merges duplicate products", () => {
    const items = parseCartItems([
      { id: "prod_mug", quantity: 2 },
      { id: "prod_mug", quantity: 3 },
    ])
    expect(items).toEqual([{ id: "prod_mug", quantity: 5 }])
  })

  it.each([
    ["undefined", undefined],
    ["an object", { id: "prod_mug" }],
    ["an empty array", []],
  ])("rejects %s", (_label, body) => {
    expect(() => parseCartItems(body)).toThrow(CartValidationError)
  })

  it.each([0, -1, 1.5, "2", null, MAX_QUANTITY_PER_ITEM + 1])(
    "rejects quantity %s",
    (quantity) => {
      expect(() => parseCartItems([{ id: "prod_mug", quantity }])).toThrow(CartValidationError)
    }
  )

  it("rejects duplicates that together exceed the quantity limit", () => {
    expect(() =>
      parseCartItems([
        { id: "prod_mug", quantity: MAX_QUANTITY_PER_ITEM },
        { id: "prod_mug", quantity: 1 },
      ])
    ).toThrow(CartValidationError)
  })

  it.each([undefined, "", 42])("rejects product id %s", (id) => {
    expect(() => parseCartItems([{ id, quantity: 1 }])).toThrow(CartValidationError)
  })
})

describe("priceCartItems", () => {
  it("uses prices from the product lookup", async () => {
    const priced = await priceCartItems([{ id: "prod_tee", quantity: 2 }], lookup)
    expect(priced).toEqual([
      { id: "prod_tee", quantity: 2, name: "T-shirt", description: null, image: "tee.png", unitAmount: 2500 },
    ])
  })

  it("rejects unknown products", async () => {
    await expect(priceCartItems([{ id: "prod_fake", quantity: 1 }], lookup)).rejects.toThrow(
      CartValidationError
    )
  })
})

describe("calculateOrderAmount", () => {
  it("sums unit amount times quantity in the smallest currency unit", async () => {
    const priced = await priceCartItems(
      [
        { id: "prod_mug", quantity: 3 },
        { id: "prod_tee", quantity: 1 },
      ],
      lookup
    )
    expect(calculateOrderAmount(priced)).toBe(3 * 1500 + 2500)
  })

  it("ignores a tampered client price", async () => {
    const items = parseCartItems([{ id: "prod_tee", quantity: 1, price: 1 }])
    const priced = await priceCartItems(items, lookup)
    expect(calculateOrderAmount(priced)).toBe(2500)
  })
})
