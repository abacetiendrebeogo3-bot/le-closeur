import React, { useEffect } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Customer, Order } from "../../types";
import { gsap } from "gsap";

interface CustomersViewProps {
  customers: Customer[];
  orders: Order[];
  openCreateCustomerModal: () => void;
  openEditCustomerModal: (customer: Customer) => void;
  setShowDeleteConfirmCustomer: (id: string | null) => void;
  setSelectedCustomerId: (id: string | null) => void;
  setCustomerSubView: (v: "list" | "history") => void;
  formatFCFA: (val: number) => string;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  orders,
  openCreateCustomerModal,
  openEditCustomerModal,
  setShowDeleteConfirmCustomer,
  setSelectedCustomerId,
  setCustomerSubView,
  formatFCFA
}) => {

  // Staggered entry for customer table rows and cards
  useEffect(() => {
    gsap.fromTo(".customer-table-row, .customer-card",
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: "power2.out" }
    );
  }, [customers]);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm">
        <h3 className="text-sm font-bold text-encre">Clients inscrits ({customers.length})</h3>
        <button
          onClick={openCreateCustomerModal}
          className="magnetic-btn bg-menthe text-neige px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un client</span>
        </button>
      </div>

      {/* TABLE FOR DESKTOP (>= 768px) */}
      <div className="hidden md:block bg-white p-6 rounded-[2rem] border border-graphite/10 shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-graphite/10 text-[9px] text-encre/40 uppercase tracking-widest font-bold">
                <th className="py-3 px-4">Nom</th>
                <th className="py-3 px-4">WhatsApp</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Adresse</th>
                <th className="py-3 px-4 text-center">Commandes</th>
                <th className="py-3 px-4 text-right">Dépenses</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {customers.map((customer) => {
                const clientOrders = orders.filter(o => o.customer === customer.name);
                const orderCount = clientOrders.length;
                const totalSpentVal = clientOrders.filter(o => o.status === "paid").reduce((acc, o) => acc + o.total, 0);

                return (
                  <tr
                    key={customer.id}
                    className="customer-table-row border-b border-graphite/5 hover:bg-neige/40 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setCustomerSubView("history");
                    }}
                  >
                    <td className="py-3.5 px-4 font-semibold text-encre">{customer.name}</td>
                    <td className="py-3.5 px-4 font-mono">{customer.phone}</td>
                    <td className="py-3.5 px-4 text-encre/60">{customer.email || "-"}</td>
                    <td className="py-3.5 px-4 text-encre/60 truncate max-w-[150px]">{customer.address || "-"}</td>
                    <td className="py-3.5 px-4 text-center font-bold tabular-nums">{orderCount}</td>
                    <td className="py-3.5 px-4 text-right font-bold tabular-nums">{formatFCFA(totalSpentVal)}</td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEditCustomerModal(customer)}
                          className="text-encre/60 hover:text-menthe p-1.5 bg-neige border border-graphite/10 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirmCustomer(customer.id)}
                          className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 border border-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CARDS LIST FOR MOBILE (< 768px) */}
      <div className="md:hidden flex flex-col gap-4">
        {customers.map((customer) => {
          const clientOrders = orders.filter(o => o.customer === customer.name);
          const orderCount = clientOrders.length;
          const totalSpentVal = clientOrders.filter(o => o.status === "paid").reduce((acc, o) => acc + o.total, 0);

          return (
            <div
              key={customer.id}
              onClick={() => {
                setSelectedCustomerId(customer.id);
                setCustomerSubView("history");
              }}
              className="customer-card bg-white p-5 rounded-[2rem] border border-graphite/10 shadow-sm flex flex-col gap-3.5 cursor-pointer hover:bg-neige/20 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="font-bold text-xs text-encre">{customer.name}</span>
                  <span className="text-[9px] text-encre/40 font-mono mt-0.5">{customer.id}</span>
                </div>
                <span className="text-xs font-black text-menthe">{formatFCFA(totalSpentVal)}</span>
              </div>

              <div className="flex flex-col gap-1 text-[10px] text-encre/60 border-t border-graphite/5 pt-3">
                <div>
                  <span className="text-encre/40 font-semibold">WhatsApp : </span>
                  <span className="font-mono text-encre">{customer.phone}</span>
                </div>
                <div>
                  <span className="text-encre/40 font-semibold">Email : </span>
                  <span className="text-encre font-medium">{customer.email || "-"}</span>
                </div>
                <div>
                  <span className="text-encre/40 font-semibold">Adresse : </span>
                  <span className="text-encre font-medium">{customer.address || "-"}</span>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-graphite/5 pt-3 mt-1" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] text-encre/50 font-bold bg-neige px-2.5 py-1 rounded-lg border border-graphite/5">
                  {orderCount} commande{orderCount > 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditCustomerModal(customer)}
                    className="text-xs font-bold text-encre/75 px-3 py-1.5 bg-neige border border-graphite/10 rounded-xl flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Modifier</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirmCustomer(customer.id)}
                    className="text-xs font-bold text-red-600 px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Supprimer</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
