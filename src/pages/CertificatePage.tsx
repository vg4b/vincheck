import React, { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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

/**
 * Post-payment result page (/certifikat/:code). The Comgate redirect carries a
 * `stav` (state) so we can show the right screen for each outcome:
 *   - paid (default): the webhook issues the certificate asynchronously, so we
 *     poll the public metadata until it's ready, then offer the PDF download.
 *   - `ceka` (pending): the payment was initiated but not completed (buyer went
 *     back, or a bank transfer is still settling). We keep polling in case it
 *     settles, but the copy makes clear it isn't finished yet.
 *   - `zruseno` (cancelled): the payment was cancelled — nothing was charged;
 *     offer to try again.
 */
const CertificatePage: React.FC = () => {
	const { code } = useParams<{ code: string }>()
	const [searchParams] = useSearchParams()
	const token = searchParams.get('token')
	const stav = searchParams.get('stav')
	const vin = searchParams.get('vin')
	const isCancelled = stav === 'zruseno'
	const isPending = stav === 'ceka'
	const [ready, setReady] = useState(false)
	const [timedOut, setTimedOut] = useState(false)

	useEffect(() => {
		// A cancelled payment will never issue a certificate — don't poll.
		if (!code || isCancelled) return
		let cancelled = false
		let attempts = 0
		const tick = async () => {
			attempts += 1
			try {
				const res = await requestJson<VerifyResponse>(
					`/api/certificate/${encodeURIComponent(code)}`
				)
				if (!cancelled && res.valid) {
					setReady(true)
					return
				}
			} catch {
				// Not issued yet (404 while pending) — keep polling.
			}
			if (cancelled) return
			if (attempts >= 20) {
				setTimedOut(true)
				return
			}
			window.setTimeout(tick, 2000)
		}
		tick()
		return () => {
			cancelled = true
		}
	}, [code, isCancelled])

	const downloadUrl =
		code && token
			? `/api/certificate/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`
			: null
	const retryUrl = vin ? `/vin/${encodeURIComponent(vin)}` : '/'

	return (
		<>
			<Navigation />
			<main className='container py-5' style={{ maxWidth: 640 }}>
				{/* Cancelled — nothing charged, offer a retry. */}
				{isCancelled && (
					<div className='text-center'>
						<h1 className='h4 mb-3'>Platba nebyla dokončena</h1>
						<p className='text-muted-ink mb-4'>
							Platbu jste zrušili a nic jsme vám neúčtovali. Certifikát můžete
							kdykoli objednat znovu.
						</p>
						<Link to={retryUrl} className='btn btn-primary'>
							Zpět na vozidlo
						</Link>
					</div>
				)}

				{/* Paid / pending — waiting for the webhook to issue the certificate. */}
				{!isCancelled && !ready && !timedOut && (
					<div className='text-center'>
						<div className='spinner-border text-primary mb-3' role='status' />
						<h1 className='h4'>
							{isPending
								? 'Kontrolujeme stav platby…'
								: 'Dokončujeme váš certifikát…'}
						</h1>
						<p className='text-muted-ink'>
							{isPending
								? 'Pokud platíte bankovním převodem, může připsání chvíli trvat.'
								: 'Potvrzujeme platbu. Obvykle to trvá jen pár vteřin.'}
						</p>
					</div>
				)}

				{!isCancelled && ready && (
					<div className='text-center'>
						<h1 className='h3 mb-3'>Děkujeme za nákup!</h1>
						<p className='mb-2'>
							Váš ověřený certifikát <strong>{code}</strong> je připravený.
						</p>
						<p className='text-muted-ink mb-4'>
							Odkaz na stažení jsme poslali i na váš e-mail.
						</p>
						{downloadUrl ? (
							<a
								href={downloadUrl}
								className='btn btn-primary btn-lg'
								target='_blank'
								rel='noopener noreferrer'
							>
								Stáhnout certifikát (PDF)
							</a>
						) : (
							<p className='alert alert-info'>
								Odkaz na stažení najdete v e-mailu, který jsme vám právě poslali.
							</p>
						)}
						<div className='mt-4'>
							<Link to={`/overit/${code}`}>Ověřit pravost certifikátu</Link>
						</div>
					</div>
				)}

				{/* Timed out without issuance. For a pending payment that likely means
				    it wasn't finished; otherwise the webhook is just slow. */}
				{!isCancelled && timedOut && (
					<div className='text-center'>
						<h1 className='h4 mb-3'>
							{isPending ? 'Platba zatím nebyla dokončena' : 'Platba se zpracovává'}
						</h1>
						<p className='text-muted-ink mb-4'>
							{isPending
								? 'Jakmile platba projde, pošleme vám odkaz na stažení e-mailem. Pokud jste platbu nedokončili, můžete ji zkusit znovu.'
								: 'Certifikát zatím není připravený. Jakmile platba projde, pošleme vám odkaz na stažení e-mailem. Můžete také tuto stránku za chvíli obnovit.'}
						</p>
						{isPending && (
							<Link to={retryUrl} className='btn btn-outline-primary'>
								Zkusit platbu znovu
							</Link>
						)}
					</div>
				)}
			</main>
			<Footer />
		</>
	)
}

export default CertificatePage
