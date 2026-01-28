import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BackButton from '@/components/common/BackButton';
import { DEFAULT_TCPA_TEXT } from '@/config/tcpa';

export const metadata = {
  title: 'Privacy Policy - My Contractor Now',
  description: 'Our privacy policy explains how we collect, use, and protect your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <BackButton className="mb-4" label="Back to Form" />
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Privacy Policy</h1>
            
            <div className="prose max-w-none">
              <p className="text-lg text-gray-600 mb-6">
                <strong>Last Updated: June 30, 2025</strong>
              </p>

              <div className="space-y-6">
                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Key Highlights</h2>
                  <ul className="list-disc pl-6 text-gray-700 space-y-1">
                    <li>Issued by Zoka Design INC</li>
                    <li>Covers information collection practices for their website</li>
                    <li>Applies to various digital and physical interaction points</li>
                    <li>Not intended for users under 18 years old</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Types of Information Collected</h2>
                  <ul className="list-disc pl-6 text-gray-700 space-y-1">
                    <li>Personal identification details</li>
                    <li>Financial and credit information</li>
                    <li>Demographic data</li>
                    <li>Geolocation information</li>
                    <li>Professional and employment details</li>
                    <li>Web browsing and interaction data</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Information Collection Methods</h2>
                  <ul className="list-disc pl-6 text-gray-700 space-y-1">
                    <li>Directly from user submissions</li>
                    <li>Automatic tracking technologies</li>
                    <li>Social media integrations</li>
                    <li>Third-party databases</li>
                    <li>Publicly available sources</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Key Privacy Protections</h2>
                  <ul className="list-disc pl-6 text-gray-700 space-y-1">
                    <li>User consent for data usage</li>
                    <li>Option to opt-out of marketing communications</li>
                    <li>Data security measures</li>
                    <li>Transparent disclosure of information sharing practices</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Notable Sections</h2>
                  <ul className="list-disc pl-6 text-gray-700 space-y-1">
                    <li>Children's Privacy</li>
                    <li>Information Use Purposes</li>
                    <li>Data Disclosure Practices</li>
                    <li>User Control Options</li>
                    <li>Data Retention Policy</li>
                    <li>Security Precautions</li>
                  </ul>
                </section>

                <section id="ccpa">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Your California Privacy Rights (CCPA)</h2>
                  <p className="text-gray-700 mb-3">
                    If you are a California resident, the California Consumer Privacy Act (CCPA) provides you with specific rights regarding your personal information:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2">
                    <li><strong>Right to Know:</strong> You have the right to request disclosure of the categories and specific pieces of personal information we have collected about you, the sources of that information, the business purposes for collecting it, and the categories of third parties with whom we share it.</li>
                    <li><strong>Right to Delete:</strong> You have the right to request deletion of your personal information, subject to certain exceptions.</li>
                    <li><strong>Right to Opt-Out:</strong> You have the right to opt-out of the sale or sharing of your personal information. To exercise this right, see the "How to Opt-Out" section below.</li>
                    <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any of your CCPA rights.</li>
                  </ul>
                  <p className="text-gray-700 mt-3">
                    To exercise any of these rights, please contact us using the information in the Contact section below. We will respond to verifiable requests within 45 days.
                  </p>
                </section>

                <section id="tcpa">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Telephone Consumer Protection Act (TCPA)</h2>
                  <p
                    className="text-gray-700"
                    dangerouslySetInnerHTML={{ __html: DEFAULT_TCPA_TEXT }}
                  />
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">How to Opt-Out</h2>
                  <p className="text-gray-700 mb-3">
                    You may opt-out of marketing communications and data sharing at any time using the following methods:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 space-y-2">
                    <li><strong>Email:</strong> Send an email to <a href="mailto:gabe@mycontractornow.com" className="text-orange-600 hover:text-orange-700">gabe@mycontractornow.com</a> with the subject line "Opt-Out Request" or "Do Not Sell My Information"</li>
                    <li><strong>Text Messages:</strong> Reply STOP to any text message you receive from us</li>
                    <li><strong>Phone Calls:</strong> Request to be placed on our do-not-call list during any call, or contact us using the information below</li>
                    <li><strong>Mail:</strong> Send a written request to our mailing address listed in the Contact section</li>
                  </ul>
                  <p className="text-gray-700 mt-3">
                    Please allow up to 10 business days for your request to be processed. Note that opting out of marketing communications will not affect transactional messages related to services you have requested.
                  </p>
                </section>

                <section id="contact">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">Contact Information</h2>
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
                <p>&copy; {new Date().getFullYear()} My Contractor Now. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}