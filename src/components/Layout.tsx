import { Link, useLocation } from 'react-router-dom'
import { Button } from './ui/button'
import { cn } from '../lib/cn'

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navItems = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About' },
    { to: '/admin', label: 'Admin' },
  ]

  return (
    <div className="min-h-screen bg-sand text-midnight">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-sand/85 border-b border-neutral-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-display text-pomegranate">Kibbeh Nayeh</span>
          </Link>
          <nav className="flex items-center gap-4">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'text-sm font-semibold text-midnight/80 transition hover:text-pomegranate',
                  location.pathname === item.to && 'text-pomegranate',
                )}
              >
                {item.label}
              </Link>
            ))}
            <Button asChild size="sm">
              <a href="#order">Order Now</a>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      <footer className="border-t border-neutral-200 bg-white/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 text-sm text-midnight/70 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-semibold text-midnight">Kibbeh Nayeh • Freshly handcrafted</div>
          <div className="flex flex-wrap gap-4">
            <Link className="hover:text-pomegranate" to="/about">About</Link>
            <a className="hover:text-pomegranate" href="mailto:orders@kibbehnayeh.com">Contact</a>
            <a className="hover:text-pomegranate" href="#policies">Policies</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

