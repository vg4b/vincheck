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
 * Post-payment success page (/certifikat/:code). The webhook that issues the
 * certificate is async, so we poll the public metadata until it's ready, then
 * offer the PDF download (token comes in via the success redirect + email).
 */
const CertificatePage: React.FC = () => {
	const { code } = useParams<{ code: string }>()
	const [searchParams] = useSearchParams()
	const token = searchParams.get('token')
	const [ready, setReady] = useState(false)
	const [timedOut, setTimedOut] = useState(false)

	useEffect(() => {
		if (!code) return
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
	}, [code])

	const downloadUrl =
		code && token
			? `/api/certificate/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`
			: null

	return (
		<>
			<Navigation />
			<main className='container py-5' style={{ maxWidth: 640 }}>
				{!ready && !timedOut && (
					<div className='text-center'>
						<div className='spinner-border text-primary mb-3' role='status' />
						<h1 className='h4'>Dokončujeme váš certifikát…</h1>
						<p className='text-muted-ink'>
							Potvrzujeme platbu. Obvykle to trvá jen pár vteřin.
						</p>
					</div>
				)}

				{ready && (
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

				{timedOut && (
					<div className='text-center'>
						<h1 className='h4 mb-3'>Platba se zpracovává</h1>
						<p className='text-muted-ink'>
							Certifikát zatím není připravený. Jakmile platba projde, pošleme
							vám odkaz na stažení e-mailem. Můžete také tuto stránku za chvíli
							obnovit.
						</p>
					</div>
				)}
			</main>
			<Footer />
		</>
	)
}

export default CertificatePage
