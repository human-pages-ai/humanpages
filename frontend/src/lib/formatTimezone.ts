export const formatTimezone = (tz: string): string => {
  const cityMap: Record<string, string> = {
    'Asia/Saigon': 'Ho Chi Minh City',
    'Asia/Ho_Chi_Minh': 'Ho Chi Minh City',
    'Asia/Calcutta': 'Kolkata',
    'Asia/Kolkata': 'Kolkata',
    'Europe/Kiev': 'Kyiv',
  };
  return cityMap[tz] || tz.split('/').pop()?.replace(/_/g, ' ') || tz;
};
