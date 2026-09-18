import Cart from "../components/Cart";

function CartPage({ cart, setCart }) {
  return (
    <Cart
      cart={cart}
      setCart={setCart}
    />
  );
}

export default CartPage;