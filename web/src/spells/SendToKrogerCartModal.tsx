import { useState } from "react";

interface GroceryItem {
  id: string;
  text: string;
  checked: boolean;
}

interface KrogerProduct {
  productId: string;
  description: string;
  brand?: string;
  size?: string;
  price?: number;
  promoPrice?: number;
}

interface SendToKrogerCartModalProps {
  items: GroceryItem[];
  onClose: () => void;
}

function formatPrice(product: KrogerProduct): string {
  if (product.promoPrice) return `$${product.promoPrice.toFixed(2)} (was $${(product.price ?? 0).toFixed(2)})`;
  if (product.price) return `$${product.price.toFixed(2)}`;
  return "";
}

export function SendToKrogerCartModal({ items, onClose }: SendToKrogerCartModalProps) {
  const [resultsByItem, setResultsByItem] = useState<Record<string, KrogerProduct[]>>({});
  const [searchingItem, setSearchingItem] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, KrogerProduct>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selectedCount = Object.keys(selected).length;

  async function search(item: GroceryItem) {
    setSearchingItem(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/spells/retail-kroger/products?q=${encodeURIComponent(item.text)}`);
      if (!res.ok) {
        const body: { error?: string } = await res.json();
        throw new Error(body.error ?? "Product search failed");
      }
      const data: { products: KrogerProduct[] } = await res.json();
      setResultsByItem((prev) => ({ ...prev, [item.id]: data.products }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product search failed");
    } finally {
      setSearchingItem(null);
    }
  }

  function pick(itemId: string, product: KrogerProduct) {
    setSelected((prev) => ({ ...prev, [itemId]: product }));
  }

  function unpick(itemId: string) {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  async function sendToCart() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/spells/retail-kroger/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: Object.values(selected).map((product) => ({ productId: product.productId, quantity: 1 })),
        }),
      });
      if (!res.ok) {
        const body: { error?: string } = await res.json();
        throw new Error(body.error ?? "Adding to cart failed");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adding to cart failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="recipe-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Send to Fred Meyer Cart"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-actions">
          <h3 className="modal-actions-title">Send to Fred Meyer Cart</h3>
          <button
            type="button"
            className="settings-save"
            onClick={sendToCart}
            disabled={sending || selectedCount === 0 || done}
          >
            {sending ? "Adding…" : `Add ${selectedCount} to Cart`}
          </button>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          {done && <p>Added to your Fred Meyer cart — finish checkout in the Kroger/Fred Meyer app or site.</p>}
          {error && <p>{error}</p>}
          {!done && (
            <ul className="grocery-list">
              {items.map((item) => {
                const results = resultsByItem[item.id];
                const pickedProduct = selected[item.id];
                return (
                  <li key={item.id} className="grocery-item kroger-match-item">
                    <div className="kroger-match-row">
                      <span>{item.text}</span>
                      {!pickedProduct && (
                        <button type="button" onClick={() => search(item)} disabled={searchingItem === item.id}>
                          {searchingItem === item.id ? "Searching…" : "Search"}
                        </button>
                      )}
                      {pickedProduct && (
                        <button type="button" onClick={() => unpick(item.id)}>
                          Clear match
                        </button>
                      )}
                    </div>
                    {pickedProduct && (
                      <p className="recipes-item-meta">
                        Matched: {pickedProduct.description} {formatPrice(pickedProduct)}
                      </p>
                    )}
                    {!pickedProduct && results && results.length === 0 && (
                      <p className="recipes-item-meta">No matches found.</p>
                    )}
                    {!pickedProduct && results && results.length > 0 && (
                      <ul className="recipes-list">
                        {results.map((product) => (
                          <li key={product.productId}>
                            <button type="button" className="recipes-item" onClick={() => pick(item.id, product)}>
                              <span className="recipes-item-title">{product.description}</span>
                              <span className="recipes-item-meta">
                                {product.brand ? `${product.brand} · ` : ""}
                                {product.size ? `${product.size} · ` : ""}
                                {formatPrice(product)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
