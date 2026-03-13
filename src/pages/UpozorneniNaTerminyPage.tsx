import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navigation from '../components/Navigation'
import { useAuth } from '../contexts/AuthContext'

const UpozorneniNaTerminyPage: React.FC = () => {
	const { user } = useAuth()

	useEffect(() => {
		document.title = 'Upozornění na STK a pojištění vozidla zdarma | VIN Info.cz'
		const meta = document.querySelector('meta[name="description"]')
		if (meta) {
			meta.setAttribute(
				'content',
				'Nastavte si připomínky na termín STK, pojištění a servis. Pošleme vám email v termínu, který si zvolíte. Zdarma, bez předplatného. Uložte si vozidlo a nikdy nezmeškejte.'
			)
		}
		return () => {
			document.title = 'VIN Info.cz'
		}
	}, [])

	const steps = [
		{
			title: 'Zkontrolujte vozidlo',
			desc: 'Zadejte VIN, TP nebo ORV a ověřte údaje v registru',
			href: '/'
		},
		{
			title: 'Uložte si vozidlo',
			desc: 'Vytvořte si účet a přidejte vozidlo do Moje VINInfo',
			href: user ? '/klientska-zona' : '/registrace'
		},
		{
			title: 'Nastavte upozornění',
			desc: 'Vyberte typ (STK, pojištění, servis…), datum a kdy vás máme upozornit – pošleme vám email',
			href: user ? '/klientska-zona' : '/registrace'
		}
	]

	const reminderTypes = [
		{ icon: '🔧', title: 'Termín STK', desc: 'Technická kontrola' },
		{ icon: '🛡️', title: 'Povinné ručení', desc: 'Platnost pojištění' },
		{ icon: '🚗', title: 'Havarijní pojištění', desc: '' },
		{ icon: '🔩', title: 'Servisní prohlídka', desc: '' },
		{ icon: '🛞', title: 'Přezutí pneumatik', desc: '' },
		{ icon: '🛣️', title: 'Dálniční známka', desc: '' },
		{ icon: '📝', title: 'Jiné', desc: 'Vlastní poznámka' }
	]

	const benefits = [
		{ icon: '📧', text: 'Email v termínu, který si zvolíte' },
		{ icon: '✨', text: '100 % zdarma' },
		{ icon: '🚗', text: 'Více vozidel na jednom místě' },
		{ icon: '📊', text: 'Přehled termínů' }
	]

	return (
		<>
			<Navigation />
			<main className='container mt-5 pb-5'>
				{/* Hero */}
				<header className='text-center text-lg-start mb-5'>
					<h1 className='mb-3'>
						Upozornění na termíny vozidla – STK, pojištění, servis zdarma
					</h1>
					<p className='lead text-muted mb-4'>
						Nikdy nezmeškejte důležitý termín. Uložte si vozidlo do Moje VINInfo
						a nechte se emailem připomenout v termínu, který si zvolíte.
					</p>
					{user ? (
						<Link to='/klientska-zona' className='btn btn-primary btn-lg'>
							Přejít do Moje VINInfo →
						</Link>
					) : (
						<Link to='/registrace' className='btn btn-primary btn-lg'>
							Vytvořit účet zdarma →
						</Link>
					)}
				</header>

				{/* Jak to funguje */}
				<section className='mb-5'>
					<h2 className='h4 mb-4'>Jak to funguje</h2>
					<div className='row g-4'>
						{steps.map((step, i) => (
							<div key={i} className='col-md-4'>
								<Link
									to={step.href}
									className='card h-100 border-0 shadow-sm text-decoration-none text-dark'
								>
									<div className='card-body'>
										<span className='badge bg-primary mb-2'>{i + 1}</span>
										<h3 className='h6 mb-2'>{step.title}</h3>
										<p className='text-muted small mb-0'>{step.desc}</p>
									</div>
								</Link>
							</div>
						))}
					</div>
				</section>

				{/* Typy upozornění */}
				<section className='mb-5'>
					<h2 className='h4 mb-4'>Na co vás upozorníme</h2>
					<div className='row g-3'>
						{reminderTypes.map((item, i) => (
							<div key={i} className='col-6 col-md-4 col-lg-3'>
								<div className='d-flex align-items-center gap-2 p-3 rounded bg-light'>
									<span className='fs-4'>{item.icon}</span>
									<div>
										<div className='fw-semibold small'>{item.title}</div>
										{item.desc && (
											<div className='text-muted small'>{item.desc}</div>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</section>

				{/* Proč Moje VINInfo */}
				<section
					className='mb-5 p-4 rounded'
					style={{ backgroundColor: '#c6dbad' }}
				>
					<h2 className='h4 mb-4'>Proč Moje VINInfo?</h2>
					<div className='row g-3'>
						{benefits.map((item, i) => (
							<div key={i} className='col-6 col-md-3'>
								<div className='d-flex flex-column align-items-center text-center'>
									<span className='fs-3 mb-1'>{item.icon}</span>
									<span>{item.text}</span>
								</div>
							</div>
						))}
					</div>
				</section>

				{/* CTA */}
				<section className='text-center py-4'>
					<h2 className='h4 mb-3'>Začněte ještě dnes</h2>
					<p className='text-muted mb-4'>
						Vytvořte si účet za minutu. Žádná platební karta, žádné předplatné.
					</p>
					{user ? (
						<Link to='/klientska-zona' className='btn btn-primary btn-lg'>
							Přejít do Moje VINInfo
						</Link>
					) : (
						<Link to='/registrace' className='btn btn-primary btn-lg'>
							Vytvořit účet zdarma
						</Link>
					)}
				</section>
			</main>
			<Footer />
		</>
	)
}

export default UpozorneniNaTerminyPage
