import {
  type Loan,
  loanDetailSchema,
  loanFiltersSchema,
  type PosMaterial,
  pageOf,
  posMaterialFiltersSchema,
  posMaterialSchema,
  problemaSchema,
  visitAuditSchema,
} from '@axis/contracts'
import { and, asc, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { customerScope, requireRole, routeScope } from '../access/scope'
import { toCustomer } from '../customers/to-customer'
import { auditItems, customers, loans, photos, posMaterials, routes, visits } from '../db/schema'
import { ApiError } from '../errors'

export function toPosMaterial(row: typeof posMaterials.$inferSelect): PosMaterial {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toLoan(row: typeof loans.$inferSelect): Loan {
  return {
    id: row.id,
    materialId: row.materialId,
    customerId: row.customerId,
    serialNumber: row.serialNumber,
    installedAt: row.installedAt,
    endedAt: row.endedAt,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Leitura de Materiais de PDV, Comodatos e Auditorias (RF16, RF17). Quem cadastra Material e
 * Comodato é o Administrador, em outro ticket; a Auditoria é gravada pelo app na Visita.
 */
export async function posRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>()
  const security = [{ bearerAuth: [] }]
  const likePattern = (term: string) => `%${term.replace(/[%_\\]/g, '\\$&')}%`

  typed.get(
    '/v1/pos-materials',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['pos'],
        summary: 'Lista o catálogo de Materiais de PDV',
        description: 'Administrador, Coordenador e Diretor. 403 para o Vendedor.',
        security,
        querystring: posMaterialFiltersSchema,
        response: {
          200: pageOf(posMaterialSchema),
          401: problemaSchema,
          403: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      requireRole(request.user, 'administrator', 'coordinator', 'director')
      const { page, perPage, search, category, active, sortBy, order } = request.query
      const where = and(
        active === undefined ? undefined : eq(posMaterials.active, active),
        category ? eq(posMaterials.category, category) : undefined,
        search
          ? or(
              ilike(posMaterials.name, likePattern(search)),
              ilike(posMaterials.category, likePattern(search)),
            )
          : undefined,
      )
      const column = {
        name: posMaterials.name,
        category: posMaterials.category,
        createdAt: posMaterials.createdAt,
      }[sortBy]
      const [total, rows] = await Promise.all([
        app.db.$count(posMaterials, where),
        app.db
          .select()
          .from(posMaterials)
          .where(where)
          .orderBy((order === 'desc' ? desc : asc)(column), asc(posMaterials.id))
          .limit(perPage)
          .offset((page - 1) * perPage),
      ])
      return { items: rows.map(toPosMaterial), total, page, perPage }
    },
  )

  typed.get(
    '/v1/loans',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['pos'],
        summary: 'Lista os Comodatos com o Material e o Cliente',
        description:
          'Administrador: todos. Vendedor, Coordenador e Diretor: os dos Clientes que enxergam. `activeOnly` esconde os encerrados.',
        security,
        querystring: loanFiltersSchema,
        response: {
          200: pageOf(loanDetailSchema),
          401: problemaSchema,
          403: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const { page, perPage, customerId, materialId, activeOnly, search, sortBy, order } =
        request.query
      const scope =
        request.user.role === 'administrator' ? undefined : customerScope(app.db, request.user)
      const where = and(
        scope
          ? inArray(
              loans.customerId,
              app.db.select({ id: customers.id }).from(customers).where(scope),
            )
          : undefined,
        customerId ? eq(loans.customerId, customerId) : undefined,
        materialId ? eq(loans.materialId, materialId) : undefined,
        activeOnly ? isNull(loans.endedAt) : undefined,
        search ? ilike(loans.serialNumber, likePattern(search)) : undefined,
      )
      const column = {
        installedAt: loans.installedAt,
        serialNumber: loans.serialNumber,
        createdAt: loans.createdAt,
      }[sortBy]
      const [total, rows] = await Promise.all([
        app.db.$count(loans, where),
        app.db
          .select({ loan: loans, material: posMaterials, customer: customers })
          .from(loans)
          .innerJoin(posMaterials, eq(loans.materialId, posMaterials.id))
          .innerJoin(customers, eq(loans.customerId, customers.id))
          .where(where)
          .orderBy((order === 'desc' ? desc : asc)(column), asc(loans.id))
          .limit(perPage)
          .offset((page - 1) * perPage),
      ])
      return {
        items: rows.map((row) => ({
          ...toLoan(row.loan),
          material: toPosMaterial(row.material),
          customer: toCustomer(row.customer),
        })),
        total,
        page,
        perPage,
      }
    },
  )

  typed.get(
    '/v1/visits/:id/audit',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['pos'],
        summary: 'Auditoria de PDV de uma Visita: itens e Fotos',
        description:
          'Dentro do escopo da rota do perfil; fora dele, 404. Visita sem Auditoria devolve as listas vazias.',
        security,
        params: z.object({ id: z.uuid() }),
        response: {
          200: visitAuditSchema,
          401: problemaSchema,
          403: problemaSchema,
          404: problemaSchema,
          422: problemaSchema,
        },
      },
    },
    async (request) => {
      const scope = routeScope(app.db, request.user)
      const [visit] = await app.db
        .select({ id: visits.id })
        .from(visits)
        .innerJoin(routes, eq(visits.routeId, routes.id))
        .where(and(eq(visits.id, request.params.id), scope))
      if (!visit) throw new ApiError(404, 'NAO_ENCONTRADO', 'Visita não encontrada')

      const [items, visitPhotos] = await Promise.all([
        app.db
          .select({ item: auditItems, loan: loans, material: posMaterials })
          .from(auditItems)
          .innerJoin(loans, eq(auditItems.loanId, loans.id))
          .innerJoin(posMaterials, eq(loans.materialId, posMaterials.id))
          .where(eq(auditItems.visitId, visit.id))
          .orderBy(asc(posMaterials.name), asc(loans.serialNumber)),
        app.db
          .select()
          .from(photos)
          .where(eq(photos.visitId, visit.id))
          .orderBy(asc(photos.takenAt), asc(photos.id)),
      ])
      return {
        visitId: visit.id,
        items: items.map(({ item, loan, material }) => ({
          id: item.id,
          visitId: item.visitId,
          loanId: item.loanId,
          condition: item.condition,
          justification: item.justification,
          occurredAt: item.occurredAt.toISOString(),
          createdAt: item.createdAt.toISOString(),
          loan: toLoan(loan),
          material: toPosMaterial(material),
        })),
        photos: visitPhotos.map((photo) => ({
          id: photo.id,
          visitId: photo.visitId,
          auditItemId: photo.auditItemId,
          storageKey: photo.storageKey,
          takenAt: photo.takenAt.toISOString(),
          createdAt: photo.createdAt.toISOString(),
        })),
      }
    },
  )
}
