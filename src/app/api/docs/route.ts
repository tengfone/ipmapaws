import { NextResponse } from 'next/server';
import { swaggerSpec } from '@/lib/swagger';

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Get OpenAPI specification
 *     description: Returns the complete OpenAPI/Swagger specification for the IPMapAWS API
 *     tags:
 *       - Documentation
 *     responses:
 *       200:
 *         description: OpenAPI specification in JSON format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export async function GET() {
  return NextResponse.json(swaggerSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
} 