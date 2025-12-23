import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import './App.css'
import GoogleAdSense from './components/GoogleAdSense'
import GoogleAnalytics from './components/GoogleAnalytics'
import SklikAd from './components/SklikAd'
import SklikScript from './components/SklikScript'
import ScrollToTop from './components/ScrollToTop'
import HavarijniPojisteniPage from './pages/HavarijniPojisteniPage'
import HomePage from './pages/HomePage'
import KompletniHistorieVozuPage from './pages/KompletniHistorieVozuPage'
import PovinneRuceniPage from './pages/PovinneRuceniPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import VehicleDetailPage from './pages/VehicleDetailPage'

function App() {
	return (
		<Router>
			<ScrollToTop />
			<GoogleAnalytics />
			<GoogleAdSense />
			<SklikScript />
			{/* Mobile Overlay */}
			<SklikAd
				zoneId={403872}
				id='ssp-zone-403872'
				width={300}
				height={600}
			/>
			{/* Desktop Pop-up */}
			<SklikAd
				zoneId={403875}
				id='ssp-zone-403875'
				width={970}
				height={310}
			/>
			<Routes>
				<Route path='/' element={<HomePage />} />
				<Route path='/povinne-ruceni' element={<PovinneRuceniPage />} />
				<Route
					path='/havarijni-pojisteni'
					element={<HavarijniPojisteniPage />}
				/>
				<Route
					path='/kompletni-historie-vozu'
					element={<KompletniHistorieVozuPage />}
				/>
				<Route path='/ochrana-osobnich-udaju' element={<PrivacyPolicyPage />} />
				<Route path='/vin/:code' element={<VehicleDetailPage type='vin' />} />
				<Route path='/tp/:code' element={<VehicleDetailPage type='tp' />} />
				<Route path='/orv/:code' element={<VehicleDetailPage type='orv' />} />
				{/* Legacy route for direct access (auto-detects VIN/TP/ORV from code length) */}
				<Route path='/:code' element={<VehicleDetailPage />} />
				{/* Catch-all redirect to home page */}
				<Route path='*' element={<HomePage />} />
			</Routes>
		</Router>
	)
}

export default App
