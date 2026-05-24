import type { FC, FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'

/**
 * Standalone search form for the "vehicles by IČO" feature. Submitting navigates
 * to /firma/:ico (FleetPage). See docs/VEHICLE_HISTORY_PANEL.md.
 */
const FleetSearchPage: FC = () => {
	const navigate = useNavigate()
	const [ico, setIco] = useState('')
	const clean = ico.replace(/\D/g, '')
	const valid = clean.length >= 5 && clean.length <= 9

	useEffect(() => {
		document.title = 'Vozidla firmy podle IČO | VIN Info.cz'
	}, [])

	const submit = (e: FormEvent) => {
		e.preventDefault()
		if (valid) {
			navigate(`/firma/${clean}`)
		}
	}

	return (
		<>
			<Navigation />
			<main className='container my-4 my-md-5' style={{ maxWidth: '640px' }}>
				<h1 className='h4 mb-2'>Vozidla firmy podle IČO</h1>
				<p className='text-muted-ink'>
					Zadejte IČO a zobrazte vozidla, která má (nebo měla) daný subjekt
					zapsaná v registru silničních vozidel.
				</p>
				<form onSubmit={submit} className='d-flex gap-2 mt-3'>
					<input
						type='text'
						inputMode='numeric'
						className='form-control'
						placeholder='IČO (8 číslic)'
						value={ico}
						onChange={(e) => setIco(e.target.value)}
						aria-label='IČO'
					/>
					<button
						type='submit'
						className='btn-brand text-nowrap'
						disabled={!valid}
					>
						Vyhledat
					</button>
				</form>
				<p className='text-muted-ink mt-3' style={{ fontSize: '0.8rem' }}>
					Údaje pocházejí z veřejného registru silničních vozidel. Zobrazujeme
					pouze právnické osoby a podnikatele (IČO), nikoli soukromé osoby.
				</p>
			</main>
			<Footer />
		</>
	)
}

export default FleetSearchPage
