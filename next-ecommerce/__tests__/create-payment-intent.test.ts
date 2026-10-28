import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextApiRequest, NextApiResponse } from "next"

// Stripe, Prisma and NextAuth are replaced with in-memory fakes,
// so these tests need no API keys, database or network.
const mocks = vi.hoisted(() => {
  class StripeInvalidRequestError extends Error {}

  const stripeProducts: Record<string, { name: string; price: number }> = {
    prod_mug: { name: "Mug", price: 1500 },
    prod_tee: { name: "T-shirt", price: 2500 },
  }

  return {
    StripeInvalidRequestError,
    stripeProducts,
    getServerSession: vi.fn(),
    stripe: {
      products: {
        retrieve: vi.fn(async (id: string) => {
          const product = stripeProducts[id]
          if (!product) throw new StripeInvalidRequestError("No such product")
          return { id, active: true, name: product.name, description: null, images: [`${id}.png`] }
        }),
      },
      prices: {
        list: vi.fn(async ({ product }: { product: string }) => ({
          data: [{ unit_amount: stripeProducts[product].price }],
        })),
      },
      paymentIntents: {
        create: vi.fn(async ({ amount }: { amount: number }) => ({ id: "pi_new", amount })),
        update: vi.fn(async (id: string, { amount }: { amount: number }) => ({ id, amount })),
      },
    },
    prisma: {
      order: {
        create: vi.fn(async () => ({ id: "order_new" })),
        findFirst: vi.fn(),
        update: vi.fn(async () => ({ id: "order_existing" })),
      },
    },
  }
})

vi.mock("stripe", () => {
  const Stripe = vi.fn(() => mocks.stripe)
  Object.assign(Stripe, { errors: { StripeInvalidRequestError: mocks.StripeInvalidRequestError } })
  return { default: Stripe }
})
vi.mock("next-auth/next", () => ({ getServerSession: mocks.getServerSession }))
vi.mock("@/pages/api/auth/[...nextauth]", () => ({ options: {} }))
vi.mock("@/util/prisma", () => ({ prisma: mocks.prisma }))

import handler from "@/pages/api/create-payment-intent"

const callHandler = async (body: unknown, method = "POST") => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: unknown) {
      this.body = data
      return this
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value
      return this
    },
  }
  await handler({ method, body } as NextApiRequest, res as unknown as NextApiResponse)
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getServerSession.mockResolvedValue({ user: { id: "user_1", name: "Test" } })
})

describe("POST /api/create-payment-intent", () => {
  it("charges the Stripe price, not the price sent by the client", async () => {
    const res = await callHandler({
      items: [{ id: "prod_tee", name: "T-shirt", price: 1, quantity: 2, image: "x.png" }],
    })

    expect(res.statusCode).toBe(200)
    expect(mocks.stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000 })
    )
    const orderData = mocks.prisma.order.create.mock.calls[0][0].data
    expect(orderData.amount).toBe(5000)
    expect(orderData.products.create[0]).toMatchObject({ name: "T-shirt", price: 2500, quantity: 2 })
  })

  it("rejects requests from users who are not logged in", async () => {
    mocks.getServerSession.mockResolvedValue(null)
    const res = await callHandler({ items: [{ id: "prod_mug", quantity: 1 }] })

    expect(res.statusCode).toBe(403)
    expect(mocks.stripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  it("rejects unknown products", async () => {
    const res = await callHandler({ items: [{ id: "prod_fake", quantity: 1 }] })

    expect(res.statusCode).toBe(400)
    expect(mocks.stripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  it("rejects invalid quantities", async () => {
    const res = await callHandler({ items: [{ id: "prod_mug", quantity: -3 }] })

    expect(res.statusCode).toBe(400)
    expect(mocks.prisma.order.create).not.toHaveBeenCalled()
  })

  it("updates an existing order owned by the user", async () => {
    mocks.prisma.order.findFirst.mockResolvedValue({ id: "order_existing", paymentIntentID: "pi_existing", products: [] })
    const res = await callHandler({
      items: [{ id: "prod_mug", quantity: 1 }],
      payment_intent_id: "pi_existing",
    })

    expect(res.statusCode).toBe(200)
    expect(mocks.prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { paymentIntentID: "pi_existing", userId: "user_1", status: "pending" },
      })
    )
    expect(mocks.stripe.paymentIntents.update).toHaveBeenCalledWith("pi_existing", { amount: 1500 })
    expect(mocks.stripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  it("never updates another user's (or a completed) order, and starts a new one instead", async () => {
    // findFirst filters by userId and status, so a foreign or completed order is not found
    mocks.prisma.order.findFirst.mockResolvedValue(null)
    const res = await callHandler({
      items: [{ id: "prod_mug", quantity: 1 }],
      payment_intent_id: "pi_someone_else",
    })

    expect(res.statusCode).toBe(200)
    expect(mocks.stripe.paymentIntents.update).not.toHaveBeenCalled()
    expect(mocks.prisma.order.update).not.toHaveBeenCalled()
    expect(mocks.stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1500 })
    )
    expect(mocks.prisma.order.create.mock.calls[0][0].data.paymentIntentID).toBe("pi_new")
  })

  it("only accepts POST", async () => {
    const res = await callHandler(undefined, "GET")

    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe("POST")
  })
})
