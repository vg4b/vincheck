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
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setSubmitting(true)
		try {
			const res = await requestJson<CreateResponse>('/api/certificate/create', {
				method: 'POST',
				body: JSON.stringify({ vin, email })
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
							<p className='mb-3'>
								Přehled historie vozidla pro VIN <strong>{vin}</strong>{' '}
								zpracovaný z dat registru silničních vozidel ČR — vlastníci, STK,
								dovoz a stav vozidla v ověřitelném PDF.
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
							{error && (
								<div className='alert alert-danger py-2 mb-0' role='alert'>
									{error}
								</div>
							)}
							<p className='text-muted-ink small mt-3 mb-0'>
								Cena zahrnuje DPH. Výpis vychází z veřejných dat registru a
								neobsahuje stav tachometru, záznamy o nehodách ani zástavy.
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
								disabled={submitting}
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
