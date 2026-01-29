import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../utils/apiClient'

type RegistrationStep = 'form' | 'verification'

const RegisterPage: React.FC = () => {
	const navigate = useNavigate()
	const { user, register, verifyEmail, resendVerification } = useAuth()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [termsAccepted, setTermsAccepted] = useState(false)
	const [marketingEnabled, setMarketingEnabled] = useState(true)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)
	const [step, setStep] = useState<RegistrationStep>('form')
	const [verificationCode, setVerificationCode] = useState('')
	const [resendLoading, setResendLoading] = useState(false)
	const [resendSuccess, setResendSuccess] = useState(false)

	useEffect(() => {
		// Only redirect if user is verified
		if (user?.email_verified_at) {
			navigate('/klientska-zona')
		}
	}, [user, navigate])

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setError('')

		if (password !== confirmPassword) {
			setError('Hesla se neshodují.')
			return
		}

		if (!termsAccepted) {
			setError('Pro registraci musíte souhlasit s obchodními podmínkami.')
			return
		}

		setLoading(true)

		try {
			const result = await register({
				email,
				password,
				termsAccepted,
				marketingEnabled
			})
			if (result.needsVerification) {
				setStep('verification')
			} else {
				navigate('/klientska-zona')
			}
		} catch (err) {
			if (err instanceof ApiError) {
				setError(err.message)
			} else {
				setError('Nepodařilo se vytvořit účet. Zkuste to znovu.')
			}
		} finally {
			setLoading(false)
		}
	}

	const handleVerify = async (event: React.FormEvent) => {
		event.preventDefault()
		setError('')

		if (verificationCode.length !== 6) {
			setError('Zadejte 6místný ověřovací kód.')
			return
		}

		setLoading(true)

		try {
			await verifyEmail(verificationCode)
			navigate('/klientska-zona')
		} catch (err) {
			if (err instanceof ApiError) {
				setError(err.message)
			} else {
				setError('Nepodařilo se ověřit email. Zkontrolujte kód a zkuste to znovu.')
			}
		} finally {
			setLoading(false)
		}
	}

	const handleResend = async () => {
		setResendLoading(true)
		setResendSuccess(false)
		setError('')

		try {
			await resendVerification()
			setResendSuccess(true)
		} catch (err) {
			if (err instanceof ApiError) {
				setError(err.message)
			} else {
				setError('Nepodařilo se odeslat nový kód.')
			}
		} finally {
			setResendLoading(false)
		}
	}

	if (step === 'verification') {
		return (
			<>
				<Navigation />
				<main className='container mt-5'>
					<h1>Ověření emailu</h1>
					<p className='text-muted'>
						Na váš email <strong>{email}</strong> jsme odeslali 6místný ověřovací kód.
						Zadejte ho níže pro dokončení registrace.
					</p>
					<form className='mt-4' onSubmit={handleVerify}>
						<div className='mb-3'>
							<label htmlFor='verificationCode' className='form-label'>
								Ověřovací kód
							</label>
							<input
								id='verificationCode'
								type='text'
								className='form-control'
								value={verificationCode}
								onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
								placeholder='000000'
								maxLength={6}
								required
								autoComplete='one-time-code'
							/>
						</div>
						{error && (
							<div className='alert alert-danger' role='alert'>
								{error}
							</div>
						)}
						{resendSuccess && (
							<div className='alert alert-success' role='alert'>
								Nový ověřovací kód byl odeslán na váš email.
							</div>
						)}
						<div className='d-flex gap-2'>
							<button
								type='submit'
								className='btn btn-primary'
								disabled={loading}
							>
								{loading ? 'Ověřuji...' : 'Ověřit email'}
							</button>
							<button
								type='button'
								className='btn btn-outline-secondary'
								onClick={handleResend}
								disabled={resendLoading}
							>
								{resendLoading ? 'Odesílám...' : 'Odeslat znovu'}
							</button>
						</div>
					</form>
					<p className='mt-3'>
						<button
							type='button'
							className='btn btn-link p-0'
							onClick={() => navigate('/klientska-zona')}
						>
							Ověřit později
						</button>
					</p>
				</main>
				<Footer />
			</>
		)
	}

	return (
		<>
			<Navigation />
			<main className='container mt-5'>
				<h1>Registrace</h1>
				<p className='text-muted'>
					Vytvořte si účet a ukládejte vozidla i upozornění na jednom místě.
				</p>
				<form className='mt-4' onSubmit={handleSubmit}>
					<div className='mb-3'>
						<label htmlFor='registerEmail' className='form-label'>
							Email
						</label>
						<input
							id='registerEmail'
							type='email'
							className='form-control'
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
						/>
					</div>
					<div className='mb-3'>
						<label htmlFor='registerPassword' className='form-label'>
							Heslo
						</label>
						<input
							id='registerPassword'
							type='password'
							className='form-control'
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
							minLength={8}
						/>
					</div>
					<div className='mb-3'>
						<label htmlFor='registerPasswordConfirm' className='form-label'>
							Potvrzení hesla
						</label>
						<input
							id='registerPasswordConfirm'
							type='password'
							className='form-control'
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
							required
							minLength={8}
						/>
					</div>
					<div className='mb-3'>
						<div className='form-check'>
							<input
								id='termsAccepted'
								type='checkbox'
								className='form-check-input'
								checked={termsAccepted}
								onChange={(event) => setTermsAccepted(event.target.checked)}
								required
							/>
							<label htmlFor='termsAccepted' className='form-check-label'>
								Souhlasím s{' '}
								<Link to='/podminky' target='_blank'>
									podmínkami služby
								</Link>{' '}
								<span className='text-danger'>*</span>
							</label>
						</div>
					</div>
					<div className='mb-3'>
						<div className='form-check'>
							<input
								id='marketingEnabled'
								type='checkbox'
								className='form-check-input'
								checked={marketingEnabled}
								onChange={(event) => setMarketingEnabled(event.target.checked)}
							/>
							<label htmlFor='marketingEnabled' className='form-check-label'>
								Souhlasím se zasíláním marketingových sdělení a novinek
							</label>
						</div>
					</div>
					{error && (
						<div className='alert alert-danger' role='alert'>
							{error}
						</div>
					)}
					<button
						type='submit'
						className='btn btn-primary'
						disabled={loading}
					>
						{loading ? 'Zakládám účet...' : 'Vytvořit účet'}
					</button>
				</form>
				<p className='mt-3'>
					Máte účet? <Link to='/prihlaseni'>Přihlásit se</Link>
				</p>
			</main>
			<Footer />
		</>
	)
}

export default RegisterPage
