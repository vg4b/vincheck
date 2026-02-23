import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Navigation: React.FC = () => {
	const location = useLocation()
	const navigate = useNavigate()
	const { user, logout } = useAuth()
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const navRef = useRef<HTMLDivElement>(null)

	const isActive = (path: string): boolean => {
		if (path === '/') {
			return location.pathname === '/'
		}
		return location.pathname === path
	}

	const handleLogout = async () => {
		await logout()
		navigate('/')
		setIsMenuOpen(false)
	}

	const closeMenu = () => {
		setIsMenuOpen(false)
	}

	// Close menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (navRef.current && !navRef.current.contains(event.target as Node)) {
				setIsMenuOpen(false)
			}
		}

		if (isMenuOpen) {
			document.addEventListener('mousedown', handleClickOutside)
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isMenuOpen])

	// Close menu on route change
	useEffect(() => {
		setIsMenuOpen(false)
	}, [location.pathname])

	return (
		<nav className='navbar navbar-expand-lg navbar-light fixed-top shadow-sm px-0' ref={navRef}>
			<div className='container-fluid px-0 px-lg-5'>
				{/* Logo */}
				<Link
					className='navbar-brand fw-bold'
					to='/'
					style={{ color: '#5a8f3e', padding: '12px' }}
				>
					<span className='d-none d-sm-inline'>VIN Info.cz</span>
					<span className='d-sm-none'>VINInfo</span>
				</Link>

				<div className='d-flex d-lg-none align-items-center ms-auto'>
					{/* Mobile: Quick access to Moje VINInfo (right aligned, before hamburger) */}
					<Link
						to='/klientska-zona'
						className='btn btn-sm me-2'
						style={{
							backgroundColor: '#5a8f3e',
							color: 'white',
							borderRadius: '20px',
							padding: '6px 12px',
							fontSize: '0.8rem'
						}}
					>
						Můj účet
					</Link>

					{/* Hamburger */}
					<button
						className='navbar-toggler border-0'
						type='button'
						onClick={() => setIsMenuOpen(!isMenuOpen)}
						aria-controls='navbarNav'
						aria-expanded={isMenuOpen}
						aria-label='Toggle navigation'
					>
						<span className='navbar-toggler-icon'></span>
					</button>
				</div>

				{/* Menu */}
				<div className={`collapse navbar-collapse ${isMenuOpen ? 'show' : ''}`} id='navbarNav'>
					<ul className='navbar-nav ms-auto align-items-lg-center gap-lg-1'>
						{/* Main Search */}
						<li className='nav-item'>
							<Link
								className={`nav-link px-3 rounded ${isActive('/') ? 'active fw-semibold' : ''}`}
								to='/'
								onClick={closeMenu}
								style={isActive('/') ? { backgroundColor: 'rgba(90, 143, 62, 0.1)', color: '#5a8f3e' } : {}}
							>
								Kontrola vozidla
							</Link>
						</li>

						{/* Insurance Dropdown */}
						<li className='nav-item dropdown'>
							<button
								className={`nav-link px-3 rounded dropdown-toggle btn btn-link text-decoration-none ${
									isActive('/povinne-ruceni') || isActive('/havarijni-pojisteni')
										? 'active fw-semibold'
										: ''
								}`}
								type='button'
								data-bs-toggle='dropdown'
								aria-expanded='false'
								style={
									isActive('/povinne-ruceni') || isActive('/havarijni-pojisteni')
										? { backgroundColor: 'rgba(90, 143, 62, 0.1)', color: '#5a8f3e' }
										: {}
								}
							>
								Pojištění
							</button>
							<ul className='dropdown-menu dropdown-menu-end shadow-sm border-0'>
								<li>
									<Link
										className={`dropdown-item ${isActive('/povinne-ruceni') ? 'active' : ''}`}
										to='/povinne-ruceni'
										onClick={closeMenu}
									>
										Povinné ručení
									</Link>
								</li>
								<li>
									<Link
										className={`dropdown-item ${isActive('/havarijni-pojisteni') ? 'active' : ''}`}
										to='/havarijni-pojisteni'
										onClick={closeMenu}
									>
										Havarijní pojištění
									</Link>
								</li>
							</ul>
						</li>

						{/* Vehicle History */}
						<li className='nav-item'>
							<Link
								className={`nav-link px-3 rounded ${isActive('/kompletni-historie-vozu') ? 'active fw-semibold' : ''}`}
								to='/kompletni-historie-vozu'
								onClick={closeMenu}
								style={isActive('/kompletni-historie-vozu') ? { backgroundColor: 'rgba(90, 143, 62, 0.1)', color: '#5a8f3e' } : {}}
							>
								Historie vozu
							</Link>
						</li>

						{/* Divider (desktop only) */}
						<li className='nav-item d-none d-lg-block'>
							<span className='nav-link px-2 text-muted'>|</span>
						</li>

						{/* Moje VINInfo - Highlighted */}
						<li className='nav-item d-none d-lg-block'>
							<Link
								to='/klientska-zona'
								className='btn btn-sm'
								onClick={closeMenu}
								style={{
									backgroundColor: isActive('/klientska-zona') ? '#4a7a32' : '#5a8f3e',
									color: 'white',
									borderRadius: '20px',
									padding: '8px 16px'
								}}
							>
								Moje VINInfo
							</Link>
						</li>

						{/* Mobile: Moje VINInfo as regular link */}
						<li className='nav-item d-lg-none'>
							<Link
								className={`nav-link px-3 rounded ${isActive('/klientska-zona') ? 'active fw-semibold' : ''}`}
								to='/klientska-zona'
								onClick={closeMenu}
								style={isActive('/klientska-zona') ? { backgroundColor: 'rgba(90, 143, 62, 0.1)', color: '#5a8f3e' } : {}}
							>
								Moje VINInfo
							</Link>
						</li>

						{/* Auth */}
						<li className='nav-item'>
							{user ? (
								<button
									type='button'
									className='nav-link px-3 btn btn-link text-decoration-none'
									onClick={handleLogout}
									style={{ color: '#6c757d' }}
								>
									Odhlásit
								</button>
							) : (
								<Link
									className={`nav-link px-3 rounded ${isActive('/prihlaseni') ? 'active fw-semibold' : ''}`}
									to='/prihlaseni'
									onClick={closeMenu}
									style={isActive('/prihlaseni') ? { backgroundColor: 'rgba(90, 143, 62, 0.1)', color: '#5a8f3e' } : {}}
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
