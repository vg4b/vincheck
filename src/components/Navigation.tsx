import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const Navigation: React.FC = () => {
	const location = useLocation()

	const isActive = (path: string): boolean => {
		if (path === '/') {
			return location.pathname === '/'
		}
		return location.pathname === path
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
					</ul>
				</div>
			</div>
		</nav>
	)
}

export default Navigation
