import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Navigation: React.FC = () => {
	const location = useLocation()
	const navigate = useNavigate()
	const { user, logout } = useAuth()

	const isActive = (path: string): boolean => {
		if (path === '/') {
			return location.pathname === '/'
		}
		return location.pathname === path
	}

	const handleLogout = async () => {
		await logout()
		navigate('/')
	}

	return (
		<nav className='navbar navbar-expand-lg navbar-dark fixed-top'>
			<div className='container-fluid'>
				<Link className='navbar-brand text-muted' to='/'>
					VIN Info.cz
				</Link>
				<button
					className='navbar-toggler'
					type='button'
					data-bs-toggle='collapse'
					data-bs-target='#navbarNav'
					aria-controls='navbarNav'
					aria-expanded='false'
					aria-label='Toggle navigation'
				>
					<span className='navbar-toggler-icon'></span>
				</button>
				<div className='collapse navbar-collapse' id='navbarNav'>
					<ul className='navbar-nav ms-auto'>
						<li className='nav-item'>
							<Link
								className={`nav-link ${isActive('/') ? 'active text-dark' : 'text-muted'}`}
								to='/'
								aria-current={isActive('/') ? 'page' : undefined}
							>
								Kontrola VIN/TP/ORV
							</Link>
						</li>
						<li className='nav-item'>
							<Link
								className={`nav-link ${isActive('/povinne-ruceni') ? 'active text-dark' : 'text-muted'}`}
								to='/povinne-ruceni'
								aria-current={isActive('/povinne-ruceni') ? 'page' : undefined}
							>
								Povinné ručení
							</Link>
						</li>
						<li className='nav-item'>
							<Link
								className={`nav-link ${isActive('/havarijni-pojisteni') ? 'active text-dark' : 'text-muted'}`}
								to='/havarijni-pojisteni'
								aria-current={
									isActive('/havarijni-pojisteni') ? 'page' : undefined
								}
							>
								Havarijní pojištění
							</Link>
						</li>
						<li className='nav-item'>
							<Link
								className={`nav-link ${isActive('/kompletni-historie-vozu') ? 'active text-dark' : 'text-muted'}`}
								to='/kompletni-historie-vozu'
								aria-current={
									isActive('/kompletni-historie-vozu') ? 'page' : undefined
								}
							>
								Kompletní historie vozu
							</Link>
						</li>
						<li className='nav-item'>
							<Link
								className={`nav-link ${isActive('/klientska-zona') ? 'active text-primary fw-semibold' : 'text-primary fw-semibold'}`}
								to='/klientska-zona'
								aria-current={isActive('/klientska-zona') ? 'page' : undefined}
							>
								Moje VINInfo
								<span className='badge bg-primary ms-2'>Můj účet</span>
							</Link>
						</li>
						<li className='nav-item'>
							{user ? (
								<button
									type='button'
									className='nav-link btn btn-link text-muted'
									onClick={handleLogout}
								>
									Odhlásit
								</button>
							) : (
								<Link
									className={`nav-link ${isActive('/prihlaseni') ? 'active text-dark' : 'text-muted'}`}
									to='/prihlaseni'
									aria-current={isActive('/prihlaseni') ? 'page' : undefined}
								>
									Přihlášení
								</Link>
							)}
						</li>
					</ul>
				</div>
			</div>
		</nav>
	)
}

export default Navigation
