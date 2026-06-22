import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { requestJson } from '../utils/apiClient'

interface VerifyResponse {
	valid: boolean
	code?: string
	vinMasked?: string
	issuedAt?: string | null
	registrySnapshotDate?: string | null
}

function fmtDate(s: string | null | undefined): string {
	if (!s) return '—'
	const d = new Date(s)
	return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('cs-CZ')
}

/**
 * Public certificate authenticity check (/overit/:code). The QR code on the PDF
 * points here. Shows only non-personal metadata — masked VIN, issue + snapshot
 * dates — never the snapshot or buyer info.
 */
const VerifyCertificatePage: React.FC = () => {
	const { code } = useParams<{ code: string }>()
	const [state, setState] = useState<'loading' | 'valid' | 'invalid'>('loading')
	const [data, setData] = useState<VerifyResponse | null>(null)

	useEffect(() => {
		if (!code) return
		let cancelled = false
		requestJson<VerifyResponse>(`/api/certificate/${encodeURIComponent(code)}`)
			.then((res) => {
				if (cancelled) return
				if (res.valid) {
					setData(res)
					setState('valid')
				} else {
					setState('invalid')
				}
			})
			.catch(() => {
				if (!cancelled) setState('invalid')
			})
		return () => {
			cancelled = true
		}
	}, [code])

	return (
		<>
			<Navigation />
			<main className='container py-5' style={{ maxWidth: 640 }}>
				<h1 className='h3 mb-4'>Ověření certifikátu</h1>

				{state === 'loading' && (
					<div className='text-center py-4'>
						<div className='spinner-border text-primary' role='status' />
					</div>
				)}

				{state === 'invalid' && (
					<div className='alert alert-danger' role='alert'>
						<strong>Certifikát nenalezen.</strong> Kód <code>{code}</code> nemá v
						naší evidenci platný vystavený certifikát.
					</div>
				)}

				{state === 'valid' && data && (
					<div className='card-soft'>
						<div className='alert alert-success' role='alert'>
							<strong>Certifikát je pravý.</strong> Vystaveno službou VIN Info.cz.
						</div>
						<table className='table mb-0'>
							<tbody>
								<tr>
									<th scope='row'>Číslo certifikátu</th>
									<td>{data.code}</td>
								</tr>
								<tr>
									<th scope='row'>VIN</th>
									<td>{data.vinMasked}</td>
								</tr>
								<tr>
									<th scope='row'>Datum vystavení</th>
									<td>{fmtDate(data.issuedAt)}</td>
								</tr>
								<tr>
									<th scope='row'>Stav dat registru k</th>
									<td>{fmtDate(data.registrySnapshotDate)}</td>
								</tr>
							</tbody>
						</table>
						<p className='text-muted-ink small mt-3 mb-0'>
							Výpis vychází z veřejných dat registru silničních vozidel ČR a není
							úředním dokumentem. Neobsahuje stav tachometru, záznamy o nehodách
							ani zástavy.
						</p>
					</div>
				)}
			</main>
			<Footer />
		</>
	)
}

export default VerifyCertificatePage
