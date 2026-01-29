import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../utils/apiClient'

const LoginPage: React.FC = () => {
	const navigate = useNavigate()
	const { user, login } = useAuth()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (user) {
			navigate('/klientska-zona')
		}
	}, [user, navigate])

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setError('')
		setLoading(true)

		try {
			await login(email, password)
			navigate('/klientska-zona')
		} catch (error) {
			if (error instanceof ApiError) {
				setError(error.message)
			} else {
				setError('Nepodařilo se přihlásit. Zkuste to znovu.')
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			<Navigation />
			<main className='container mt-5'>
				<h1>Přihlášení do Moje VINInfo</h1>
				<p className='text-muted'>
					Přihlaste se pro správu uložených vozidel a upozornění.
				</p>
				<form className='mt-4' onSubmit={handleSubmit}>
					<div className='mb-3'>
						<label htmlFor='loginEmail' className='form-label'>
							Email
						</label>
						<input
							id='loginEmail'
							type='email'
							className='form-control'
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
						/>
					</div>
					<div className='mb-3'>
						<label htmlFor='loginPassword' className='form-label'>
							Heslo
						</label>
						<input
							id='loginPassword'
							type='password'
							className='form-control'
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
							minLength={8}
						/>
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
						{loading ? 'Přihlašuji...' : 'Přihlásit se'}
					</button>
				</form>
				<p className='mt-3'>
					Nemáte účet? <Link to='/registrace'>Založit účet</Link>
				</p>
			</main>
			<Footer />
		</>
	)
}

export default LoginPage
