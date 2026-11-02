import type { Customer } from '@axis/contracts'
import type { customers } from '../db/schema'

/** A linha do banco no formato do contrato: instantes em ISO 8601 (UTC). */
export function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    legalName: row.legalName,
    tradeName: row.tradeName,
    document: row.document,
    phone: row.phone,
    contactName: row.contactName,
    zipCode: row.zipCode,
    street: row.street,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    latitude: row.latitude,
    longitude: row.longitude,
    origin: row.origin,
    status: row.status,
    coordinatorId: row.coordinatorId,
    createdById: row.createdById,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
