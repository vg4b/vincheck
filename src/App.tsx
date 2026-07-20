import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import './App.css'
import GoogleAnalytics from './components/GoogleAnalytics'
import ScrollToTop from './components/ScrollToTop'
import BrandModelStatsPage from './pages/BrandModelStatsPage'
import CertificateLandingPage from './pages/CertificateLandingPage'
import CertificatePage from './pages/CertificatePage'
import ClientZonePage from './pages/ClientZonePage'
import FleetPage from './pages/FleetPage'
import FleetSearchPage from './pages/FleetSearchPage'
import HavarijniPojisteniPage from './pages/HavarijniPojisteniPage'
import HomePage from './pages/HomePage'
import KompletniHistorieVozuPage from './pages/KompletniHistorieVozuPage'
import KontaktPage from './pages/KontaktPage'
import LoginPage from './pages/LoginPage'
import PlatbaPage from './pages/PlatbaPage'
import PovinneRuceniPage from './pages/PovinneRuceniPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import RegisterPage from './pages/RegisterPage'
import SjednatPojisteniPage from './pages/SjednatPojisteniPage'
import TermsPage from './pages/TermsPage'
import UpozorneniNaTerminyPage from './pages/UpozorneniNaTerminyPage'
import VehicleDetailPage from './pages/VehicleDetailPage'
import VerifyCertificatePage from './pages/VerifyCertificatePage'
import ZnackyHubPage from './pages/ZnackyHubPage'

function App() {
	return (
		<Router>
			<ScrollToTop />
			<GoogleAnalytics />
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
				<Route path='/kontakt' element={<KontaktPage />} />
				<Route path='/platba' element={<PlatbaPage />} />
				<Route path='/podminky' element={<TermsPage />} />
				<Route path='/vin/:code' element={<VehicleDetailPage type='vin' />} />
				<Route path='/tp/:code' element={<VehicleDetailPage type='tp' />} />
				<Route path='/orv/:code' element={<VehicleDetailPage type='orv' />} />
				<Route path='/s/:code' element={<VehicleDetailPage type='share' />} />
				<Route path='/firma' element={<FleetSearchPage />} />
				<Route path='/firma/:ico' element={<FleetPage />} />
				<Route path='/znacky' element={<ZnackyHubPage />} />
				<Route path='/znacky/:brand/:model' element={<BrandModelStatsPage />} />
				<Route
					path='/overeny-vypis-vozidla'
					element={<CertificateLandingPage />}
				/>
				<Route path='/certifikat/:code' element={<CertificatePage />} />
				<Route path='/overit/:code' element={<VerifyCertificatePage />} />
				{/* Legacy route for direct access (auto-detects VIN/TP/ORV from code length) */}
				<Route path='/:code' element={<VehicleDetailPage />} />
				{/* Catch-all redirect to home page */}
				<Route path='*' element={<HomePage />} />
			</Routes>
		</Router>
	)
}

export default App
