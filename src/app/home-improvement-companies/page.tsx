import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Home Improvement Companies - My Contractor Now',
  description: 'List of authorized home improvement companies that may receive shared data.',
};

export default function HomeImprovementCompaniesPage() {
  const companies = [
    "Modernize",
    "West Shore Home", 
    "ADVERSITY MARKETING INC dba SocMedia Digital",
    "Advanced Marketing Solutions",
    "All American Roofing and Remodeling",
    "American Remodeling Enterprises Inc",
    "American Residential Services LLC",
    "Blue Ink Digital",
    "Cardo Windows dba Castle the Window People",
    "Carpet Wagon Glendale Inc",
    "Certitude Roofing, LLC",
    "Choice Home Warranty",
    "DBS General Contractors",
    "DSC Service and Solutions",
    "DaBella",
    "Dwelle LLC",
    "Ecrux LLC dba QuoteMe Network",
    "Enhance Home Solutions",
    "Everconnect",
    "Everything Solar",
    "GVG Holdings LLC",
    "GoGreen Builders",
    "Homefix Custom Remodeling",
    "Hubstart dba SolarCharge",
    "Improveit Home Remodeling Inc",
    "Joyce Factory Direct",
    "Leadspring ISA",
    "Legacy Residential Solutions LLC",
    "Loan Bright",
    "Loyalty Health LLC",
    "Luca Builders LLC DBA Castle The Window People",
    "Modern Exteriors LLC",
    "Peterman Heating Cooling and Plumbing",
    "Pinnacle Home Improvements LLC",
    "Porch.com",
    "Power Home Remodeling",
    "Premier Home Pros LLC",
    "Pro American Roofing",
    "ProEdge Remodeling",
    "Purelight Power",
    "Quality Craftsmen",
    "Quality First Home Improvement, Inc",
    "Rainmaker Marketing",
    "Reinform dba Structurely",
    "Renuity LLC",
    "RROC LLC",
    "SIR HOME IMPROVEMENTS",
    "Saidman-Jones Consulting LLC",
    "Samit Media",
    "Thompson Creek Window",
    "Total Bath Systems LLC",
    "US Marketing Group",
    "Universal Windows Direct",
    "Victory Home Remodeling",
    "Vision Solar"
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      
      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Home Improvement Companies</h1>
            
            <div className="prose max-w-none">
              <p className="text-lg text-gray-600 mb-6">
                The following home improvement companies are authorized to receive shared data when you submit a request through our platform:
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">
                      Data Sharing Notice
                    </h3>
                    <div className="mt-2 text-sm text-amber-700">
                      <p>By submitting your information, you authorize My Contractor Now and up to four of these companies to contact you regarding your inquiry.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companies.map((company, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-900">{index + 1}.</span>
                    <span className="ml-2 text-gray-700">{company}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Your Privacy Rights</h3>
                <p className="text-blue-800 mb-3">
                  You have the right to know which companies may contact you and can opt-out of communications at any time.
                </p>
                <p className="text-sm text-blue-700">
                  For more information about how we handle your data, please review our{' '}
                  <a href="/privacy-policy" className="text-blue-800 hover:text-blue-900 underline">Privacy Policy</a> and{' '}
                  <a href="/terms-and-conditions" className="text-blue-800 hover:text-blue-900 underline">Terms and Conditions</a>.
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200 text-center text-gray-600">
                <p>&copy; 2025 My Contractor Now. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}