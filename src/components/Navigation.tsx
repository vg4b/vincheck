import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import BrandMark from './BrandMark'

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

	useEffect(() => {
		setIsMenuOpen(false)
	}, [location.pathname])

	const navLinkClass = (path: string) =>
		`nav-link px-3 rounded text-nowrap ${isActive(path) ? 'active' : ''}`

	return (
		<nav
			className='navbar navbar-expand-xl navbar-light fixed-top px-0'
			ref={navRef}
		>
			<div className='container-fluid px-0 px-lg-4'>
				<Link className='navbar-brand d-flex align-items-center gap-2' to='/'>
					<BrandMark width={36} height={22} color='var(--brand-600)' />
					<span className='d-none d-sm-inline'>VIN Info.cz</span>
					<span className='d-sm-none'>VINInfo</span>
				</Link>

				<div className='d-flex d-xl-none align-items-center ms-auto'>
					<Link to='/klientska-zona' className='btn-brand btn-sm me-2'>
						Můj účet
					</Link>

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

				<div
					className={`collapse navbar-collapse ${isMenuOpen ? 'show' : ''}`}
					id='navbarNav'
				>
					<ul className='navbar-nav ms-auto align-items-lg-center gap-lg-1 flex-nowrap'>
						<li className='nav-item'>
							<Link className={navLinkClass('/')} to='/' onClick={closeMenu}>
								Kontrola vozidla
							</Link>
						</li>

						<li className='nav-item dropdown'>
							{/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
							<a
								className={`nav-link px-3 rounded dropdown-toggle text-nowrap ${
									isActive('/povinne-ruceni') ||
									isActive('/havarijni-pojisteni') ||
									isActive('/sjednat-pojisteni')
										? 'active'
										: ''
								}`}
								href='#'
								role='button'
								data-bs-toggle='dropdown'
								aria-expanded='false'
								onClick={(e) => e.preventDefault()}
							>
								Pojištění
							</a>
							<ul className='dropdown-menu dropdown-menu-end shadow-sm border-0'>
								<li>
									<Link
										className={`dropdown-item fw-semibold ${isActive('/sjednat-pojisteni') ? 'active' : ''}`}
										to='/sjednat-pojisteni?src=nav'
										onClick={closeMenu}
									>
										Sjednat pojištění
									</Link>
								</li>
								<li>
									<hr className='dropdown-divider' />
								</li>
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

						<li className='nav-item'>
							<Link
								className={navLinkClass('/kompletni-historie-vozu')}
								to='/kompletni-historie-vozu'
								onClick={closeMenu}
							>
								Historie vozu
							</Link>
						</li>

						<li className='nav-item'>
							<Link
								className={navLinkClass('/upozorneni-na-terminy')}
								to='/upozorneni-na-terminy'
								onClick={closeMenu}
							>
								Upozornění
							</Link>
						</li>

						<li className='nav-item d-none d-xl-block'>
							<span className='nav-link px-2 text-muted-ink'>|</span>
						</li>

						<li className='nav-item d-none d-xl-block'>
							<Link
								to='/klientska-zona'
								className='btn-brand text-nowrap'
								onClick={closeMenu}
							>
								Moje VINInfo
							</Link>
						</li>

						<li className='nav-item d-xl-none'>
							<Link
								className={navLinkClass('/klientska-zona')}
								to='/klientska-zona'
								onClick={closeMenu}
							>
								Moje VINInfo
							</Link>
						</li>

						<li className='nav-item'>
							{user ? (
								<button
									type='button'
									className='nav-link px-3 btn btn-link text-decoration-none text-nowrap text-muted-ink'
									onClick={handleLogout}
								>
									Odhlásit
								</button>
							) : (
								<Link
									className={navLinkClass('/prihlaseni')}
									to='/prihlaseni'
									onClick={closeMenu}
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
