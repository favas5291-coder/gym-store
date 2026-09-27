import Modal from "./Modal.jsx";
import FitFinder from "./tryon/FitFinder.jsx";
export default function FitGuide({ product, color, onSelectSize, onClose }) {
  return <Modal title={`Size & fit · ${product.name}`} onClose={onClose} className="fit-guide-modal">
    <p><strong>Available labels:</strong> {product.sizes?.join(", ") || "One size"}</p>
    <p><strong>Product fit:</strong> {product.specifications?.Fit || "See the product details."}</p>
    <FitFinder product={product} color={color} onSelect={onSelectSize}/>
    {Array.isArray(product.sizeChart?.columns) && Array.isArray(product.sizeChart?.rows) && <div className="try-table-wrap"><table className="try-table"><caption>{product.sizeChart.caption || "Additional supplier information"}</caption><thead><tr>{product.sizeChart.columns.map(c=><th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{product.sizeChart.rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>}
  </Modal>;
}