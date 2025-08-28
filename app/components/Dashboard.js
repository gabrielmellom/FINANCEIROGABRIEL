import { useState, useEffect } from 'react';
import { db } from '../irebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { format, addMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Edit2, Trash2, Check, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

const Dashboard = () => {
  const [contas, setContas] = useState([]);
  const [categorias] = useState(['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Trabalho', 'Serviços']);
  const [mesAtual, setMesAtual] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingConta, setEditingConta] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    tipo: 'receber',
    categoria: '',
    dataVencimento: '',
    recorrente: false,
    numParcelas: 1,
    intervaloParcelas: 1,
    pago: false
  });

  // Buscar contas do Firebase
  useEffect(() => {
    const q = query(collection(db, 'contas'), orderBy('dataVencimento'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const contasData = [];
      querySnapshot.forEach((doc) => {
        contasData.push({ id: doc.id, ...doc.data() });
      });
      setContas(contasData);
      setLoading(false);
    }, (error) => {
      console.error('Erro ao buscar contas:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Gerar parcelas recorrentes
  const gerarParcelas = (conta) => {
    const parcelas = [];
    const dataBase = parseISO(conta.dataVencimento);
    
    for (let i = 0; i < conta.numParcelas; i++) {
      const dataVencimento = addMonths(dataBase, i * conta.intervaloParcelas);
      parcelas.push({
        ...conta,
        id: `${conta.id}_${i}`,
        parcelaAtual: i + 1,
        dataVencimento: format(dataVencimento, 'yyyy-MM-dd'),
        dataVencimentoOriginal: conta.dataVencimento
      });
    }
    return parcelas;
  };

  // Obter todas as contas do mês (incluindo parcelas)
  const getContasMes = () => {
    const inicioMes = startOfMonth(mesAtual);
    const fimMes = endOfMonth(mesAtual);
    
    let todasContas = [];
    
    contas.forEach(conta => {
      if (conta.recorrente && conta.numParcelas > 1) {
        const parcelas = gerarParcelas(conta);
        todasContas = [...todasContas, ...parcelas];
      } else {
        todasContas.push(conta);
      }
    });

    return todasContas.filter(conta => {
      const dataVencimento = parseISO(conta.dataVencimento);
      return isWithinInterval(dataVencimento, { start: inicioMes, end: fimMes });
    });
  };

  const contasMes = getContasMes();
  const contasReceber = contasMes.filter(c => c.tipo === 'receber');
  const contasPagar = contasMes.filter(c => c.tipo === 'pagar');
  
  const totalReceber = contasReceber.reduce((sum, c) => sum + (c.pago ? 0 : parseFloat(c.valor)), 0);
  const totalPagar = contasPagar.reduce((sum, c) => sum + (c.pago ? 0 : parseFloat(c.valor)), 0);
  const totalReceberPago = contasReceber.reduce((sum, c) => sum + (c.pago ? parseFloat(c.valor) : 0), 0);
  const totalPagarPago = contasPagar.reduce((sum, c) => sum + (c.pago ? parseFloat(c.valor) : 0), 0);
  const saldoPrevisto = totalReceber - totalPagar;
  const saldoRealizado = totalReceberPago - totalPagarPago;

  // Salvar conta
  const salvarConta = async (e) => {
    e.preventDefault();
    
    try {
      const dadosConta = {
        ...formData,
        valor: parseFloat(formData.valor),
        numParcelas: parseInt(formData.numParcelas),
        intervaloParcelas: parseInt(formData.intervaloParcelas),
        createdAt: new Date()
      };

      if (editingConta) {
        await updateDoc(doc(db, 'contas', editingConta.id), dadosConta);
      } else {
        await addDoc(collection(db, 'contas'), dadosConta);
      }

      resetForm();
    } catch (error) {
      console.error('Erro ao salvar conta:', error);
      alert('Erro ao salvar conta. Verifique sua conexão.');
    }
  };

  // Marcar como pago/não pago
  const togglePago = async (conta) => {
    try {
      if (conta.parcelaAtual) {
        const novoRegistro = {
          ...conta,
          id: undefined,
          pago: !conta.pago,
          dataVencimentoOriginal: conta.dataVencimentoOriginal
        };
        await addDoc(collection(db, 'contas'), novoRegistro);
      } else {
        await updateDoc(doc(db, 'contas', conta.id), { pago: !conta.pago });
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status. Tente novamente.');
    }
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      valor: '',
      tipo: 'receber',
      categoria: '',
      dataVencimento: '',
      recorrente: false,
      numParcelas: 1,
      intervaloParcelas: 1,
      pago: false
    });
    setShowForm(false);
    setEditingConta(null);
  };

  const editarConta = (conta) => {
    setFormData({
      ...conta,
      valor: conta.valor.toString(),
      numParcelas: conta.numParcelas?.toString() || '1',
      intervaloParcelas: conta.intervaloParcelas?.toString() || '1'
    });
    setEditingConta(conta);
    setShowForm(true);
  };

  const excluirConta = async (conta) => {
    if (confirm('Tem certeza que deseja excluir esta conta?')) {
      try {
        await deleteDoc(doc(db, 'contas', conta.id));
      } catch (error) {
        console.error('Erro ao excluir conta:', error);
        alert('Erro ao excluir conta.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando sistema financeiro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">💰 Sistema Financeiro</h1>
            <p className="text-gray-600">Controle suas finanças de forma simples e eficiente</p>
          </div>
          
          {/* Navegação de meses */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => setMesAtual(addMonths(mesAtual, -1))}
              className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            >
              ←
            </button>
            <h2 className="text-xl font-semibold text-gray-800 min-w-[200px] text-center capitalize">
              {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button
              onClick={() => setMesAtual(addMonths(mesAtual, 1))}
              className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            >
              →
            </button>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-100 p-4 rounded-lg border-l-4 border-green-500">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="text-green-600" size={18} />
                <span className="font-medium text-green-800">A Receber</span>
              </div>
              <p className="text-xl font-bold text-green-600">
                R$ {totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600">
                Recebido: R$ {totalReceberPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-500">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="text-red-600" size={18} />
                <span className="font-medium text-red-800">A Pagar</span>
              </div>
              <p className="text-xl font-bold text-red-600">
                R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-red-600">
                Pago: R$ {totalPagarPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className={`p-4 rounded-lg border-l-4 ${saldoPrevisto >= 0 ? 'bg-blue-100 border-blue-500' : 'bg-orange-100 border-orange-500'}`}>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className={saldoPrevisto >= 0 ? 'text-blue-600' : 'text-orange-600'} size={18} />
                <span className={`font-medium ${saldoPrevisto >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                  Saldo Previsto
                </span>
              </div>
              <p className={`text-xl font-bold ${saldoPrevisto >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                R$ {saldoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className={`p-4 rounded-lg border-l-4 ${saldoRealizado >= 0 ? 'bg-purple-100 border-purple-500' : 'bg-yellow-100 border-yellow-500'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Check className={saldoRealizado >= 0 ? 'text-purple-600' : 'text-yellow-600'} size={18} />
                <span className={`font-medium ${saldoRealizado >= 0 ? 'text-purple-800' : 'text-yellow-800'}`}>
                  Saldo Realizado
                </span>
              </div>
              <p className={`text-xl font-bold ${saldoRealizado >= 0 ? 'text-purple-600' : 'text-yellow-600'}`}>
                R$ {saldoRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              <Plus size={20} />
              Nova Conta
            </button>
          </div>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingConta ? '✏️ Editar Conta' : '➕ Nova Conta'}
              </h3>
              
              <form onSubmit={salvarConta}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <input
                      type="text"
                      placeholder="Ex: Salário, Aluguel, Cliente XYZ..."
                      value={formData.descricao}
                      onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={formData.valor}
                      onChange={(e) => setFormData({...formData, valor: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={formData.tipo}
                      onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="receber">💰 A Receber</option>
                      <option value="pagar">💸 A Pagar</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select
                      value={formData.categoria}
                      onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecione uma categoria</option>
                      {categorias.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Vencimento</label>
                    <input
                      type="date"
                      value={formData.dataVencimento}
                      onChange={(e) => setFormData({...formData, dataVencimento: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      id="recorrente"
                      checked={formData.recorrente}
                      onChange={(e) => setFormData({...formData, recorrente: e.target.checked})}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="recorrente" className="text-sm font-medium text-gray-700">
                      🔄 Conta recorrente (parcelas)
                    </label>
                  </div>
                  
                  {formData.recorrente && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg">
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">Nº Parcelas</label>
                        <input
                          type="number"
                          min="1"
                          max="120"
                          placeholder="12"
                          value={formData.numParcelas}
                          onChange={(e) => setFormData({...formData, numParcelas: e.target.value})}
                          className="w-full p-2 border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">Intervalo (meses)</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          placeholder="1"
                          value={formData.intervaloParcelas}
                          onChange={(e) => setFormData({...formData, intervaloParcelas: e.target.value})}
                          className="w-full p-2 border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {editingConta ? '💾 Salvar' : '➕ Criar'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-300 text-gray-700 p-3 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                  >
                    ❌ Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lista de contas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contas a Receber */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-green-600 mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              Contas a Receber ({contasReceber.length})
            </h3>
            <div className="space-y-3">
              {contasReceber.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>📋 Nenhuma conta a receber neste mês</p>
                </div>
              ) : (
                contasReceber.map((conta) => (
                  <div key={conta.id} className={`p-4 rounded-lg border transition-all hover:shadow-md ${conta.pago ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-green-300'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium ${conta.pago ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                            {conta.descricao}
                          </span>
                          {conta.parcelaAtual && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">
                              {conta.parcelaAtual}/{conta.numParcelas}
                            </span>
                          )}
                          {conta.pago && (
                            <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full font-medium">
                              ✅ Pago
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mb-2">
                          📁 {conta.categoria} • 📅 {format(parseISO(conta.dataVencimento), 'dd/MM/yyyy')}
                        </div>
                        <div className="font-bold text-green-600 text-lg">
                          R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-4">
                        <button
                          onClick={() => togglePago(conta)}
                          className={`p-2 rounded transition-colors ${conta.pago ? 'text-green-600 bg-green-100 hover:bg-green-200' : 'text-gray-400 hover:text-green-600 hover:bg-green-100'}`}
                          title={conta.pago ? 'Marcar como não pago' : 'Marcar como pago'}
                        >
                          <Check size={16} />
                        </button>
                        {!conta.parcelaAtual && (
                          <>
                            <button
                              onClick={() => editarConta(conta)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                              title="Editar conta"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => excluirConta(conta)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                              title="Excluir conta"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Contas a Pagar */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
              <TrendingDown size={20} />
              Contas a Pagar ({contasPagar.length})
            </h3>
            <div className="space-y-3">
              {contasPagar.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>📋 Nenhuma conta a pagar neste mês</p>
                </div>
              ) : (
                contasPagar.map((conta) => (
                  <div key={conta.id} className={`p-4 rounded-lg border transition-all hover:shadow-md ${conta.pago ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:border-red-300'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium ${conta.pago ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                            {conta.descricao}
                          </span>
                          {conta.parcelaAtual && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">
                              {conta.parcelaAtual}/{conta.numParcelas}
                            </span>
                          )}
                          {conta.pago && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                              ✅ Pago
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mb-2">
                          📁 {conta.categoria} • 📅 {format(parseISO(conta.dataVencimento), 'dd/MM/yyyy')}
                        </div>
                        <div className="font-bold text-red-600 text-lg">
                          R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-4">
                        <button
                          onClick={() => togglePago(conta)}
                          className={`p-2 rounded transition-colors ${conta.pago ? 'text-red-600 bg-red-100 hover:bg-red-200' : 'text-gray-400 hover:text-red-600 hover:bg-red-100'}`}
                          title={conta.pago ? 'Marcar como não pago' : 'Marcar como pago'}
                        >
                          <Check size={16} />
                        </button>
                        {!conta.parcelaAtual && (
                          <>
                            <button
                              onClick={() => editarConta(conta)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                              title="Editar conta"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => excluirConta(conta)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                              title="Excluir conta"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>💡 Dica: Use contas recorrentes para contratos e parcelas que se repetem mensalmente</p>
          <p className="mt-1">📱 Sistema responsivo - funciona perfeitamente no celular</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;