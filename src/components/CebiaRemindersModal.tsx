import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser } from '../types'

export type CebiaRemindersModalIntro = 'not_found' | 'vehicle_detail'

export interface CebiaRemindersModalProps {
	open: boolean
	onClose: () => void
	user: AuthUser | null
	cebiaRetryUrl: string
	intro: CebiaRemindersModalIntro
}

/**
 * Modal po otevření Cebie v novém tabu – upozornění na Moje VINInfo (sdílené HP not_found + detail VIN).
 */
export const CebiaRemindersModal: React.FC<CebiaRemindersModalProps> = ({
	open,
	onClose,
	user,
	cebiaRetryUrl,
	intro,
}) => {
	useEffect(() => {
		if (!open) return
		const prev = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.body.style.overflow = prev
		}
	}, [open])

	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [open, onClose])

	if (!open) return null

	const introLead =
		intro === 'not_found' ? (
			<>
				Rozšířená prověrka se otevřela v <strong>nové záložce</strong>.
			</>
		) : (
			<>
				Prověření historie vozidla se otevřelo v <strong>nové záložce</strong>.
			</>
		)

	return (
		<>
			<div
				className='modal fade show'
				style={{ display: 'block' }}
				tabIndex={-1}
				role='dialog'
				aria-modal='true'
				aria-labelledby='cebiaRemindersModalTitle'
				id='cebiaRemindersModal'
			>
				<div className='modal-dialog modal-dialog-centered modal-dialog-scrollable'>
					<div className='modal-content'>
						<div className='modal-header'>
							<h2 className='modal-title h5' id='cebiaRemindersModalTitle'>
								Upozornění na termíny zdarma
							</h2>
							<button type='button' className='btn-close' aria-label='Zavřít' onClick={onClose} />
						</div>
						<div className='modal-body'>
							<p className='mb-3'>
								{introLead}{' '}
								Zde na VIN Info si mezitím můžete zdarma nastavit <strong>e-mailové připomínky</strong> na STK,
								pojištění, servis a další termíny — v <strong>Moje VINInfo</strong>. Mezi taby můžete libovolně
								přepínat; toto okno zůstane otevřené, dokud ho sami nezavřete.
							</p>
							<ul className='small mb-3'>
								<li>žádné předplatné, upozornění podle data, které zvolíte</li>
								<li>vhodné i když zatím nemáte kompletní údaje z registru</li>
							</ul>
							<p className='mb-0'>
								<Link to='/upozorneni-na-terminy' className='small' onClick={onClose}>
									Jak fungují upozornění na termíny →
								</Link>
							</p>
						</div>
						<div className='modal-footer flex-column align-items-stretch gap-2'>
							{user ? (
								<Link to='/klientska-zona' className='btn btn-primary' onClick={onClose}>
									Přejít do Moje VINInfo
								</Link>
							) : (
								<Link to='/registrace' className='btn btn-primary' onClick={onClose}>
									Vytvořit účet a nastavit připomínky
								</Link>
							)}
							<a
								href={cebiaRetryUrl}
								className='btn btn-outline-primary'
								target='_blank'
								rel='noopener noreferrer'
							>
								Otevřít prověrku znovu v novém tabu
							</a>
						</div>
					</div>
				</div>
			</div>
			<div className='modal-backdrop fade show' aria-hidden='true' onClick={onClose} />
		</>
	)
}
