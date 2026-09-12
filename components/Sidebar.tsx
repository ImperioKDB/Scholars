'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// CORRECTED: Changed from './icons' to '@/components/icons' to match your project structure
import { DashboardIcon, HealthIcon, ScholarshipIcon, OpportunitiesIcon, UsersIcon, TestimonialsIcon } from '@/components/icons';

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const adminNavItems: NavItem[] = [
    { href: "/admin", label: "Overview", Icon: DashboardIcon },
    { href: "/admin/health", label: "Health", Icon: HealthIcon },
    { href: "/admin/scholarships", label: "Scholarships", Icon: ScholarshipIcon },
    { href: "/admin/opportunities", label: "Opportunities", Icon: OpportunitiesIcon },
    { href: "/admin/active-users", label: "Active Users", Icon: UsersIcon },
    { href: "/admin/testimonials", label: "Testimonials", Icon: TestimonialsIcon },
  ];

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md"
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          {isMobileMenuOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 transform md:transform-none md:relative w-64 bg-white shadow-md z-40 h-full overflow-y-auto transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:block`}
      >
        <div className="p-6">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-display font-bold text-navy text-lg">Scholars Admin</span>
          </Link>
        </div>
        
        <nav className="mt-8">
          <h3 className="px-6 text-xs font-semibold text-navy-light uppercase tracking-wider">Management</h3>
          <ul className="mt-2">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors ${isActive 
                      ? 'text-navy bg-navy-50' 
                      : 'text-navy-light hover:text-navy hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <item.Icon className={`w-5 h-5 ${isActive ? 'text-navy' : 'text-navy-light'}`} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      
      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}