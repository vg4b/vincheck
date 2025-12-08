import React from 'react'

const Footer: React.FC = () => {
	return (
		<footer className='footer mt-auto py-3 bg-light m'>
			<div className='container d-flex justify-content-between'>
				<span className='text-muted' id='left'>
					VinInfo.cz - Kontrola vozidel zdarma | Všechny informace jsou
					poskytovány bez záruky. | Zdroj dat:{' '}
					<a
						href='https://www.dataovozidlech.cz/'
						target='_blank'
						rel='noopener noreferrer'
					>
						Datová kostka
					</a>{' '}
					| <a href='/#/ochrana-osobnich-udaju'>Ochrana osobních údajů</a> |
					© 2025 by{' '}
					<a href='https://fixweb.cz' target='_blank' rel='noopener noreferrer'>
						FixWeb.cz
					</a>
				</span>
			</div>
		</footer>
	)
}

export default Footer
