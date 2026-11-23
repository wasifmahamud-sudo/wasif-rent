            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => navigate('/tenant/bills')}
            >
              View All Bills →
            </button>
          </div>
        )}

        {/* Recent Payments */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div
            style={{
              fontWeight: 800,
              color: 'var(--primary)',
              marginBottom: 10,
            }}
          >
            💰 Recent Payments
          </div>

          {payments.length === 0 ? (
            <div className="empty" style={{ padding: 12 }}>
              এখনো কোনো পেমেন্ট পাওয়া যায়নি
            </div>
          ) : (
            payments.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="bill-row"
                style={{ padding: '10px 0' }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {p.payment_date}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--muted)',
                    }}
                  >
                    {p.payment_method}
                  </div>
                </div>

                <div
                  style={{
                    fontWeight: 800,
                    color: 'var(--accent)',
                  }}
                >
                  ৳{fmtBDT(p.amount)}
                </div>
              </div>
            ))
          )}

          {payments.length > 0 && (
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => navigate('/tenant/payments')}
            >
              View All Payments →
            </button>
          )}
        </div>

        {/* Payment Receipts */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div
            style={{
              fontWeight: 800,
              color: 'var(--primary)',
              marginBottom: 8,
            }}
          >
            🧾 Payment Receipts
          </div>

          <div
            style={{
              fontSize: '0.82rem',
              color: 'var(--muted)',
              marginBottom: 12,
            }}
          >
            আপনার পেমেন্টের রসিদ দেখুন এবং PDF ডাউনলোড করুন।
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/tenant/receipts')}
          >
            View My Receipts →
          </button>
        </div>
      </div>
    </div>
  )
}
