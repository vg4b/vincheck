import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import './App.css'
import GoogleAnalytics from './components/GoogleAnalytics'
import ScrollToTop from './components/ScrollToTop'
import SklikAd from './components/SklikAd'
import SklikScript from './components/SklikScript'
import ClientZonePage from './pages/ClientZonePage'
import FleetPage from './pages/FleetPage'
import HavarijniPojisteniPage from './pages/HavarijniPojisteniPage'
import HomePage from './pages/HomePage'
import KompletniHistorieVozuPage from './pages/KompletniHistorieVozuPage'
import LoginPage from './pages/LoginPage'
import PovinneRuceniPage from './pages/PovinneRuceniPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import RegisterPage from './pages/RegisterPage'
import SjednatPojisteniPage from './pages/SjednatPojisteniPage'
import TermsPage from './pages/TermsPage'
import UpozorneniNaTerminyPage from './pages/UpozorneniNaTerminyPage'
import VehicleDetailPage from './pages/VehicleDetailPage'

function App() {
	return (
		<Router>
			<ScrollToTop />
			<GoogleAnalytics />
			<SklikScript />
			{/* Mobile Overlay */}
			<SklikAd zoneId={403872} id='ssp-zone-403872' width={300} height={600} />
			{/* Desktop Pop-up */}
			<SklikAd zoneId={403875} id='ssp-zone-403875' width={970} height={310} />
			<Routes>
				<Route path='/' element={<HomePage />} />
				<Route path='/klientska-zona' element={<ClientZonePage />} />
				<Route path='/prihlaseni' element={<LoginPage />} />
				<Route path='/registrace' element={<RegisterPage />} />
				<Route path='/povinne-ruceni' element={<PovinneRuceniPage />} />
				<Route
					path='/havarijni-pojisteni'
					element={<HavarijniPojisteniPage />}
				/>
				<Route path='/sjednat-pojisteni' element={<SjednatPojisteniPage />} />
				<Route
					path='/kompletni-historie-vozu'
					element={<KompletniHistorieVozuPage />}
				/>
				<Route
					path='/upozorneni-na-terminy'
					element={<UpozorneniNaTerminyPage />}
				/>
				<Route path='/ochrana-osobnich-udaju' element={<PrivacyPolicyPage />} />
				<Route path='/podminky' element={<TermsPage />} />
				<Route path='/vin/:code' element={<VehicleDetailPage type='vin' />} />
				<Route path='/tp/:code' element={<VehicleDetailPage type='tp' />} />
				<Route path='/orv/:code' element={<VehicleDetailPage type='orv' />} />
				<Route path='/firma/:ico' element={<FleetPage />} />
				{/* Legacy route for direct access (auto-detects VIN/TP/ORV from code length) */}
				<Route path='/:code' element={<VehicleDetailPage />} />
				{/* Catch-all redirect to home page */}
				<Route path='*' element={<HomePage />} />
			</Routes>
		</Router>
	)
}

export default App
