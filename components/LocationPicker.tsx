import dynamic from 'next/dynamic';

export type PickedLocation = {
  address: string;
  lat: number;
  lng: number;
};

const LocationPicker = dynamic(() => import('./LocationPickerInner'), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] rounded-lg bg-recess flex items-center justify-center text-sm text-ink-4 animate-pulse">
      Loading map…
    </div>
  ),
});

export default LocationPicker;
