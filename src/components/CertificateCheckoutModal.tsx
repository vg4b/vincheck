import React, { useState } from 'react'
import { ApiError, requestJson } from '../utils/apiClient'

interface CertificateCheckoutModalProps {
	vin: string
	priceCzk: number
	onClose: () => void
}

interface CreateResponse {
	code: string
	checkoutUrl: string
}

/**
 * Guest-checkout modal: collects an email, starts a certificate purchase, then
 * redirects to the hosted payment page. No account required.
 */
const CertificateCheckoutModal: React.FC<CertificateCheckoutModalProps> = ({
	vin,
	priceCzk,
	onClose
}) => {
	const [email, setEmail] = useState('')
	const [agreed, setAgreed] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!agreed) {
			setError('Pro pokračování je nutné souhlasit s obchodními podmínkami.')
			return
		}
		setError(null)
		setSubmitting(true)
		try {
			const res = await requestJson<CreateResponse>('/api/certificate/create', {
				method: 'POST',
				body: JSON.stringify({ vin, email, termsAccepted: agreed })
			})
			// Hand off to the hosted payment page.
			window.location.href = res.checkoutUrl
		} catch (err) {
			setError(
				err instanceof ApiError
					? err.message
					: 'Něco se pokazilo. Zkuste to prosím znovu.'
			)
			setSubmitting(false)
		}
	}

	return (
		<div
			className='modal d-block'
			tabIndex={-1}
			role='dialog'
			style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
			onClick={onClose}
		>
			<div
				className='modal-dialog modal-dialog-centered'
				role='document'
				onClick={(e) => e.stopPropagation()}
			>
				<div className='modal-content'>
					<div className='modal-header'>
						<h5 className='modal-title'>Ověřený certifikát historie vozidla</h5>
						<button
							type='button'
							className='btn-close'
							aria-label='Zavřít'
							onClick={onClose}
						/>
					</div>
					<form onSubmit={handleSubmit}>
						<div className='modal-body'>
							<p className='mb-2'>
								Přehled historie vozidla pro VIN <strong>{vin}</strong>{' '}
								zpracovaný z dat registru silničních vozidel ČR a STK — vlastníci,
								historie STK, stav tachometru, dovoz a stav vozidla v ověřitelném
								PDF.
							</p>
							<p className='mb-3'>
								<a
									href='/api/certificate/sample'
									target='_blank'
									rel='noopener noreferrer'
								>
									Prohlédnout ukázku certifikátu (PDF) ↗
								</a>
							</p>
							<div className='mb-3'>
								<label htmlFor='cert-email' className='form-label'>
									E-mail pro doručení certifikátu
								</label>
								<input
									id='cert-email'
									type='email'
									className='form-control'
									value={email}
									onChange={(ev) => setEmail(ev.target.value)}
									placeholder='vas@email.cz'
									required
									autoFocus
								/>
							</div>
							<div className='form-check mb-2'>
								<input
									id='cert-terms'
									type='checkbox'
									className='form-check-input'
									checked={agreed}
									onChange={(ev) => setAgreed(ev.target.checked)}
									required
								/>
								<label
									htmlFor='cert-terms'
									className='form-check-label small text-muted-ink'
								>
									Souhlasím s{' '}
									<a href='/podminky' target='_blank' rel='noopener noreferrer'>
										obchodními podmínkami
									</a>{' '}
									a žádám o dodání certifikátu (digitálního obsahu) ihned po
									zaplacení. Beru na vědomí, že tím ztrácím právo na odstoupení od
									smlouvy.
								</label>
							</div>
							{error && (
								<div className='alert alert-danger py-2 mb-0' role='alert'>
									{error}
								</div>
							)}
							<p className='text-muted-ink small mt-3 mb-0'>
								Cena je konečná (nejsme plátci DPH). Výpis vychází z veřejných dat
								registru a STK a neobsahuje záznamy o nehodách ani zástavy.
							</p>
						</div>
						<div className='modal-footer'>
							<button
								type='button'
								className='btn btn-outline-secondary'
								onClick={onClose}
								disabled={submitting}
							>
								Zrušit
							</button>
							<button
								type='submit'
								className='btn btn-primary'
								disabled={submitting || !agreed}
							>
								{submitting
									? 'Přesměrování…'
									: `Zaplatit ${priceCzk} Kč`}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	)
}

export default CertificateCheckoutModal
