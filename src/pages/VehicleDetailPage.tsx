import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import VehicleInfo from '../components/VehicleInfo'
import { VehicleDataArray } from '../types'
import { fetchVehicleInfo, getDataValue } from '../utils/vehicleApi'

interface VehicleDetailPageProps {
	type?: 'vin' | 'tp' | 'orv'
}

const VehicleDetailPage: React.FC<VehicleDetailPageProps> = ({ type }) => {
	const params = useParams<{ code?: string }>()
	const navigate = useNavigate()
	const [vehicleData, setVehicleData] = useState<VehicleDataArray | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		const loadVehicleData = async () => {
			// Get code from params
			const code = params.code

			if (!code) {
				navigate('/')
				return
			}

			// Reject known routes
			const knownRoutes = [
				'povinne-ruceni',
				'havarijni-pojisteni',
				'vin',
				'tp',
				'orv'
			]
			if (knownRoutes.includes(code.toLowerCase())) {
				navigate('/')
				return
			}

			// Clean the code (remove non-alphanumeric characters)
			const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '')

			// Determine the search type (use prop or detect from code length for legacy routes)
			let searchType: 'vin' | 'tp' | 'orv'

			if (type) {
				// Explicit type from route (e.g., /vin/:code, /tp/:code, /orv/:code)
				searchType = type
			} else {
				// Legacy route - auto-detect type from code length
				if (cleanCode.length === 17) {
					searchType = 'vin'
				} else if (cleanCode.length >= 6 && cleanCode.length <= 10) {
					searchType = 'tp'
				} else if (cleanCode.length >= 5 && cleanCode.length <= 9) {
					searchType = 'orv'
				} else {
					// Invalid length, will fail validation below
					searchType = 'vin' // Default, but validation will catch it
				}
			}

			// Validate based on search type
			let isValid = false
			if (searchType === 'vin') {
				isValid = cleanCode.length === 17
			} else if (searchType === 'tp') {
				isValid = cleanCode.length >= 6 && cleanCode.length <= 10
			} else if (searchType === 'orv') {
				isValid = cleanCode.length >= 5 && cleanCode.length <= 9
			}

			if (!isValid) {
				navigate('/')
				return
			}

			setLoading(true)
			setError('')

			try {
				const vinParam = searchType === 'vin' ? cleanCode : undefined
				const tpParam = searchType === 'tp' ? cleanCode : undefined
				const orvParam = searchType === 'orv' ? cleanCode : undefined

				const data = await fetchVehicleInfo(vinParam, tpParam, orvParam)
				setVehicleData(data)

				// Update page title
				const vinCode = getDataValue(data, 'VIN', cleanCode)
				const brand = getDataValue(data, 'TovarniZnacka', '')
				const model = getDataValue(data, 'Typ', '')
				document.title = `${brand} ${model} - ${vinCode} | VIN Info.cz`

				// Update meta description
				const metaDescription = document.querySelector(
					'meta[name="description"]'
				)
				if (metaDescription) {
					metaDescription.setAttribute(
						'content',
						`Informace o vozidle ${vinCode}: ${brand} ${model}. Zkontrolujte údaje o vozidle v českém registru vozidel zdarma.`
					)
				}
			} catch (err) {
				console.error('Chyba při načítání dat:', err)
				const errorMessage =
					searchType === 'vin'
						? 'Vozidlo s tímto VIN kódem nebylo nalezeno v registru.'
						: searchType === 'tp'
							? 'Vozidlo s tímto číslem TP nebylo nalezeno v registru.'
							: 'Vozidlo s tímto číslem ORV nebylo nalezeno v registru.'
				setError(errorMessage)
				// Redirect to home page after a short delay
				setTimeout(() => {
					navigate('/')
				}, 2000)
			} finally {
				setLoading(false)
			}
		}

		loadVehicleData()
	}, [params.code, type, navigate])

	if (loading) {
		return (
			<>
				<Navigation />
				<div className='container mt-5'>
					<div className='text-center'>
						<div className='spinner-border' role='status'>
							<span className='visually-hidden'>Načítání...</span>
						</div>
						<p className='mt-3'>Načítání informací o vozidle...</p>
					</div>
				</div>
				<Footer />
			</>
		)
	}

	if (error || !vehicleData) {
		return (
			<>
				<Navigation />
				<div className='container mt-5'>
					<div className='alert alert-danger' role='alert'>
						<h4 className='alert-heading'>Chyba</h4>
						<p>{error || 'Vozidlo nebylo nalezeno.'}</p>
						<hr />
						<p className='mb-0'>Přesměrování na hlavní stránku...</p>
					</div>
				</div>
				<Footer />
			</>
		)
	}

	const code = params.code || ''
	const vinCode = getDataValue(vehicleData, 'VIN', code)

	return (
		<>
			<Navigation />
			<div className='container mt-5'>
				<div className='mb-3'>
					<button
						type='button'
						className='btn btn-primary'
						onClick={() => navigate('/')}
					>
						← Vyhledat jiné vozidlo
					</button>
				</div>
				<VehicleInfo data={vehicleData} vinCode={vinCode} />
			</div>
			<Footer />
		</>
	)
}

export default VehicleDetailPage
