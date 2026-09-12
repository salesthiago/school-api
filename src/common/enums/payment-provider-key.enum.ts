/** Gateways de pagamento suportados. Cada chave mapeia para uma implementação de PaymentProvider. */
export enum PaymentProviderKey {
  /** Itaú — Pix e Pix recorrente (não faz cartão). */
  ITAU = 'itau',
  /** Stripe — cartão de crédito/débito (integração futura). */
  STRIPE = 'stripe',
  /** Registro manual/offline — sem gateway; admin confirma o pagamento na mão. */
  MANUAL = 'manual',
}
