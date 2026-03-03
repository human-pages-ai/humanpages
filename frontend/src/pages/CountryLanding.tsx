import { useEffect } from 'react';
import { useUTMParams } from '../hooks/useUTMParams';
import { analytics } from '../lib/analytics';
import LandingPage from './LandingPage';

interface CountryLandingProps {
  countryCode: string;
  countryName: string;
}

export default function CountryLanding({ countryCode, countryName }: CountryLandingProps) {
  const utmParams = useUTMParams();

  useEffect(() => {
    analytics.track('country_landing_view', {
      country_code: countryCode,
      country_name: countryName,
      ...utmParams,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <LandingPage />;
}
