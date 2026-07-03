/**
 * Shared helpers for the certificate endpoints: code/token generation, price and
 * base-URL config, VIN masking. Kept separate so create/webhook/[code] stay DRY.
 */
import crypto from 'crypto'
import type { VehicleCacheResult } from './_vehicleCache'

// Unambiguous alphabet (no 0/O/1/I) for human-readable, phone-friendly codes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Public certificate code, e.g. `VI-7F3K-9Q2T`. Printed on the PDF + verify page. */
export function generateCode(): string {
	const pick = (n: number) =>
		Array.from(
			{ length: n },
			() => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]
		).join('')
	return `VI-${pick(4)}-${pick(4)}`
}

/** Opaque token gating PDF re-download (lives in the emailed link). */
export function generateDownloadToken(): string {
	return crypto.randomBytes(24).toString('hex')
}

/**
 * Certificate price in whole crowns. With Comgate this is the amount actually
 * charged (passed to /create). We are a neplátce, so the price is final with no
 * VAT. (With the Lemon Squeezy fallback the real charge is the variant price.)
 */
export function getCertificatePriceCzk(): number {
	const raw = Number(process.env.CERTIFICATE_PRICE_CZK)
	return Number.isFinite(raw) && raw > 0 ? raw : 99
}

/** Public site origin for building success/verify/download URLs. No trailing slash. */
export function getPublicBaseUrl(): string {
	return (process.env.PUBLIC_BASE_URL ?? 'https://www.vininfo.cz').replace(/\/$/, '')
}

/** Mask a VIN for public display: keep the first 3 and last 4 chars. */
export function maskVin(vin: string): string {
	if (vin.length <= 7) return vin
	return `${vin.slice(0, 3)}…${vin.slice(-4)}`
}

/**
 * Realistic dummy data for the public sample ("UKÁZKA") certificate, so buyers
 * can see exactly what they get before paying. Not a real vehicle.
 */
export function buildSampleSnapshot(): VehicleCacheResult {
	return {
		response: {
			Status: 200,
			Data: {
				VIN: 'TMBJX7NE0J0XXXXXX',
				TovarniZnacka: 'ŠKODA',
				Typ: '5E',
				ObchodniOznaceni: 'OCTAVIA',
				DatumPrvniRegistrace: '2018-04-12',
				DatumPrvniRegistraceVCr: '2018-04-12',
				CisloTp: 'UABC123456',
				CisloOrv: 'XY456789',
				StatusNazev: 'Provozované',
				Kategorie: 'M1',
				VozidloDruh: 'OSOBNÍ AUTOMOBIL',
				VozidloVyrobce: 'ŠKODA AUTO a.s.',
				MotorVyrobce: 'ŠKODA',
				MotorTyp: 'DFGA',
				MotorMaxVykon: '110 / 3500',
				MotorZdvihObjem: '1968',
				Palivo: 'Nafta',
				EmiseCO2: '120',
				EmisniUroven: 'EURO 6',
				VozidloKaroserieBarva: 'Šedá metalíza',
				VozidloKaroserieMist: '5/5/0',
				Rozmery: '4670/1814/1476',
				RozmeryRozvor: '2686',
				HmotnostiProvozni: '1395',
				NapravyPocetDruh: '2/1',
				NejvyssiRychlost: '212',
				RokVyroby: '2018'
			}
		},
		snapshot: '2026-05-01',
		history: {
			owners: {
				total: 2,
				operators: 2,
				companies: 1,
				everCompanyOwned: true,
				currentlyCompany: false,
				companyOwners: [],
				timeline: [
					{
						subjectType: 'company',
						ico: '00177041',
						nazev: 'Autopůjčovna Příklad s.r.o.',
						from: '2018-04-12',
						to: '2020-01-01',
						current: false,
						relation: 'owner'
					},
					{
						subjectType: 'private',
						ico: null,
						nazev: null,
						from: '2020-01-01',
						to: null,
						current: true,
						relation: 'owner'
					}
				]
			},
			inspections: {
				total: 2,
				failed: 1,
				distinctStations: 2,
				latest: null,
				// Newest first, matching the real cache (ORDER BY platnost_od DESC);
				// the renderers reverse this to show oldest → newest.
				history: [
					{
						date: '2024-05-01',
						result: 'defects',
						nazevStk: 'STK Brno',
						typ: 'P',
						administrative: false
					},
					{
						date: '2022-05-01',
						result: 'pass',
						nazevStk: 'STK Praha',
						typ: 'P',
						administrative: false
					}
				]
			},
			flags: {
				stolen: false,
				exported: false,
				deregistered: false,
				insuranceLapsed: false,
				statusLabel: 'Provozované'
			},
			deregistrations: [],
			imports: [{ country: 'Německo', date: '2018-03-01' }],
			mileage: {
				latestKm: 142500,
				readings: [
					{ date: '2018-04-12', km: 5 },
					{ date: '2020-04-20', km: 41200 },
					{ date: '2022-05-01', km: 88300 },
					{ date: '2024-05-01', km: 121900 },
					{ date: '2026-04-28', km: 142500 }
				],
				rollbackSuspected: false,
				avgKmPerYear: 17800
			},
			snapshot: '2026-05-01'
		}
	}
}
