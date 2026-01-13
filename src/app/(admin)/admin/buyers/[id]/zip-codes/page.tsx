'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuyerServiceZipManager } from '@/components/admin/BuyerServiceZipManager';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function BuyerZipCodesPage() {
  const params = useParams();
  const router = useRouter();
  const buyerId = params.id as string;

  const [buyer, setBuyer] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real buyer and service data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch buyer details and services in parallel
        const [buyerResponse, servicesResponse] = await Promise.all([
          fetch(`/api/admin/buyers/${buyerId}`, {
            headers: {
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
            }
          }),
          fetch('/api/service-types?includeInactive=true', {
            headers: {
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''}`
            }
          })
        ]);

        if (!buyerResponse.ok) {
          throw new Error('Failed to fetch buyer data');
        }

        const buyerData = await buyerResponse.json();
        const servicesData = servicesResponse.ok ? await servicesResponse.json() : { data: [] };

        // Set buyer data
        const buyerInfo = buyerData.data?.buyer || buyerData.data;
        setBuyer({
          id: buyerInfo.id,
          name: buyerInfo.name,
          displayName: buyerInfo.displayName || buyerInfo.name,
          apiUrl: buyerInfo.apiUrl,
          active: buyerInfo.active,
          createdAt: new Date(buyerInfo.createdAt)
        });

        // Set services data
        const serviceList = servicesData.data || [];
        setServices(serviceList.map((s: any) => ({
          id: s.id,
          name: s.name,
          displayName: s.displayName || s.name
        })));

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (buyerId) {
      fetchData();
    }
  }, [buyerId]);

  const handleUpdate = () => {
    // Callback for when zip codes are updated
    // In production, you might want to refetch buyer statistics
    console.log('Zip codes updated');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="flex items-center space-x-4 mb-6">
            <div className="h-8 w-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Zip Code Management</h1>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Failed to load buyer data</span>
            </div>
            <p className="text-red-700 mt-2">{error}</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!buyer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Buyer Not Found</h1>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Buyer Not Found
            </h3>
            <p className="text-gray-500 mb-6">
              The buyer you're looking for doesn't exist or has been removed.
            </p>
            <Button
              onClick={() => router.push('/admin/buyers')}
              variant="outline"
            >
              Back to Buyers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {buyer.displayName || buyer.name}
          </h1>
          <p className="text-gray-500">
            Configure zip code coverage for lead distribution
          </p>
        </div>
      </div>

      {/* Main Component */}
      <BuyerServiceZipManager
        buyerId={buyerId}
        buyerName={buyer.displayName || buyer.name}
        services={services}
        onUpdate={handleUpdate}
        loading={loading}
      />
    </div>
  );
}