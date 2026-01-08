import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BackButton from '@/components/common/BackButton';

export const metadata = {
  title: 'Terms and Conditions - My Contractor Now',
  description: 'Our terms and conditions outline the rules and guidelines for using our service.',
};

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <BackButton className="mb-4" label="Back to Form" />
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Terms and Conditions</h1>
            
            <div className="prose max-w-none">
              <p className="text-lg text-gray-600 mb-6">
                <strong>Effective Date: January 1, 2025</strong>
              </p>

              <div className="space-y-6">
                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Acceptance of Terms</h2>
                  <p className="text-gray-700">
                    By accessing and using the website operated by Zoka Design INC ("Service"), you accept and agree to be bound by the terms and provision of this agreement.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Use License</h2>
                  <p className="text-gray-700 mb-3">
                    Permission is granted to temporarily download one copy of the materials for personal, non-commercial transitory viewing only. Under this license you may not:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-1">
                    <li>Modify or copy the materials</li>
                    <li>Use materials for commercial purposes</li>
                    <li>Attempt to decompile or reverse engineer software</li>
                    <li>Remove copyright or proprietary notations</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Service Description</h2>
                  <p className="text-gray-700">
                    Zoka Design INC provides a platform connecting homeowners with home improvement contractors. They facilitate connections but are not responsible for work quality or outcomes.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Lead Generation and Distribution</h2>
                  <p className="text-gray-700">
                    By submitting information, you authorize Zoka Design INC and up to four affiliated companies to contact you about your inquiry via phone, email, and text.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">5. User Responsibilities</h2>
                  <p className="text-gray-700 mb-3">You agree to:</p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-1">
                    <li>Provide accurate and complete information</li>
                    <li>Maintain account confidentiality</li>
                    <li>Be responsible for all account activities</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Privacy</h2>
                  <p className="text-gray-700">
                    Use of the service is governed by the Privacy Policy, which details data collection practices.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Disclaimer</h2>
                  <p className="text-gray-700">
                    Materials are provided "as is" with no warranties, expressed or implied.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Limitations</h2>
                  <p className="text-gray-700">
                    Zoka Design INC is not liable for damages arising from website use or inability to use materials.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Contractor Relationships</h2>
                  <p className="text-gray-700">
                    The company is not responsible for contractor actions, work quality, or pricing.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Modifications</h2>
                  <p className="text-gray-700">
                    Terms may be revised at any time without notice.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">11. Governing Law</h2>
                  <p className="text-gray-700">
                    Terms are governed by Massachusetts law.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">12. Contact Information</h2>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-800">My Contractor Now</p>
                    <p className="text-gray-700">22 N Main St</p>
                    <p className="text-gray-700">Leominster, MA 01453</p>
                    <p className="text-gray-700 mt-2">
                      Email: <a href="mailto:gabe@mycontractornow.com" className="text-orange-600 hover:text-orange-700">gabe@mycontractornow.com</a>
                    </p>
                  </div>
                </section>
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