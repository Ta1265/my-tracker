import ProductClient from './ProductClient';

export default function ProductPage({
  searchParams,
}: {
  searchParams: { unit?: string; name?: string };
}) {
  const { unit, name } = searchParams;

  if (!unit || !name) {
    return <div></div>;
  }

  return <ProductClient unit={unit} productFullName={name} />;
}
