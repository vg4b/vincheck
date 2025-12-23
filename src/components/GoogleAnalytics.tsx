import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const TRACKING_ID = 'G-6KCMP7F17E'

const GoogleAnalytics = () => {
	const location = useLocation()

	useEffect(() => {
		// Don't track on Privacy Policy page
		if (location.pathname === '/ochrana-osobnich-udaju') {
			return
		}

		// Check if script is already present
		const scriptId = 'ga-script'
		if (document.getElementById(scriptId)) {
			return
		}

		// Inject script
		const script1 = document.createElement('script')
		script1.async = true
		script1.src = `https://www.googletagmanager.com/gtag/js?id=${TRACKING_ID}`
		script1.id = scriptId

		const script2 = document.createElement('script')
		script2.id = 'ga-config-script'
		script2.innerHTML = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${TRACKING_ID}');
        `

		document.head.appendChild(script1)
		document.head.appendChild(script2)
	}, [location])

	return null
}

export default GoogleAnalytics

