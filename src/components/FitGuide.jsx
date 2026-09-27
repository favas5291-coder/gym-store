import Modal from "./Modal.jsx";
export default function FitGuide({ product, onClose }) {
  const chart = product.sizeChart;
  return (
    <Modal title={`Size & fit · ${product.name}`} onClose={onClose}>
      <p>
        <strong>Available labels:</strong>{" "}
        {product.sizes?.join(", ") || "One size"}
      </p>
      <p>
        <strong>Fit:</strong>{" "}
        {product.specifications?.Fit ||
          "See the product details and garment label."}
      </p>
      {Array.isArray(chart?.columns) && Array.isArray(chart?.rows) ? (
        <div className="comparison-scroll">
          <table className="data-table">
            <caption>
              {chart.caption || `Measurements (${chart.unit || "as supplied"})`}
            </caption>
            <thead>
              <tr>
                {chart.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="notice">
          The supplier has not provided a measurement chart for this item. Size
          labels alone do not confirm body measurements or shoe-size
          conversions.
        </p>
      )}
      <h3>How to check your fit</h3>
      {product.category === "Gym Shoes" ? (
        <p>
          Measure from your heel to your longest toe while standing. Compare
          that measurement with the supplier’s chart once it is available, and
          check the size system on the product label.
        </p>
      ) : (
        <p>
          Use a flexible tape and compare your measurements with a well-fitting
          garment. Keep the tape level around your chest or waist. Check the
          product’s fit and material before choosing a size.
        </p>
      )}
      <p>
        Need a measurement? Use “Ask about this product” on the product page.
      </p>
    </Modal>
  );
}