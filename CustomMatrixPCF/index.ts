import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { DetailsList, IColumn, DetailsListLayoutMode, SelectionMode } from "@fluentui/react/lib/DetailsList";
import { Stack } from "@fluentui/react/lib/Stack";
import { Text } from "@fluentui/react/lib/Text";

// ============================================================================
// INTERFACES
// ============================================================================

interface IPivotConfig {
    groupByRow: string;
    groupByColumn: string;
    valueField: string;
    aggregationType: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT';
}

interface ICellData {
    values: number[];
    count: number;
}

interface IPivotData {
    rowKeys: string[];
    columnKeys: string[];
    gridData: Map<string, number>;
}

// ============================================================================
// PIVOT TRANSFORMATION LOGIC
// ============================================================================

/**
 * Transforms a PCF dataset into pivot table structure
 * @param dataset The PCF dataset from context.parameters
 * @param config Configuration for grouping and aggregation
 * @returns Structured pivot data with row keys, column keys, and aggregated values
 */
function transformDatasetToPivot(
    dataset: ComponentFramework.PropertyTypes.DataSet,
    config: IPivotConfig
): IPivotData {
    // Validate dataset
    if (!dataset || !dataset.columns || dataset.columns.length === 0) {
        throw new Error("Dataset is not properly configured");
    }

    if (!dataset.sortedRecordIds || dataset.sortedRecordIds.length === 0) {
        return {
            rowKeys: [],
            columnKeys: [],
            gridData: new Map<string, number>()
        };
    }

    // Find the column definitions
    const rowColumn = dataset.columns.find(col => col.name === config.groupByRow);
    const columnColumn = dataset.columns.find(col => col.name === config.groupByColumn);
    const valueColumn = dataset.columns.find(col => col.name === config.valueField);

    if (!rowColumn) {
        throw new Error(`Row field '${config.groupByRow}' not found in dataset columns`);
    }
    if (!columnColumn) {
        throw new Error(`Column field '${config.groupByColumn}' not found in dataset columns`);
    }
    if (!valueColumn) {
        throw new Error(`Value field '${config.valueField}' not found in dataset columns`);
    }

    // Check for Lookup fields and reject them
    if (rowColumn.dataType === "Lookup.Simple" || rowColumn.dataType === "Lookup.Customer" || 
        rowColumn.dataType === "Lookup.Owner" || rowColumn.dataType === "Lookup.PartyList" ||
        rowColumn.dataType === "Lookup.Regarding") {
        throw new Error(`Row field '${config.groupByRow}' is a Lookup field, which is not supported. Please select a different field.`);
    }
    if (columnColumn.dataType === "Lookup.Simple" || columnColumn.dataType === "Lookup.Customer" || 
        columnColumn.dataType === "Lookup.Owner" || columnColumn.dataType === "Lookup.PartyList" ||
        columnColumn.dataType === "Lookup.Regarding") {
        throw new Error(`Column field '${config.groupByColumn}' is a Lookup field, which is not supported. Please select a different field.`);
    }

    // Validate valueField data type based on aggregation type
    const isNumericField = valueColumn.dataType === "Whole.None" || 
                           valueColumn.dataType === "Decimal" || 
                           valueColumn.dataType === "Currency" || 
                           valueColumn.dataType === "FP";
    const isDateField = valueColumn.dataType === "DateAndTime.DateOnly" || 
                        valueColumn.dataType === "DateAndTime.DateAndTime";

    if (config.aggregationType === 'SUM' || config.aggregationType === 'AVG') {
        if (!isNumericField) {
            throw new Error(`Aggregation type '${config.aggregationType}' requires a numeric or currency field. Field '${config.valueField}' is of type '${valueColumn.dataType}'.`);
        }
    }

    if (config.aggregationType === 'MIN' || config.aggregationType === 'MAX') {
        if (!isNumericField && !isDateField) {
            throw new Error(`Aggregation type '${config.aggregationType}' requires a numeric, currency, or date field. Field '${config.valueField}' is of type '${valueColumn.dataType}'.`);
        }
    }

    // Build pivot structure
    const rowSet = new Set<string>();
    const columnSet = new Set<string>();
    const cellDataMap = new Map<string, ICellData>();

    // Iterate through sorted records
    dataset.sortedRecordIds.forEach(recordId => {
        const record = dataset.records[recordId];
        
        // Get row key (use formatted value for OptionSets, raw value for others)
        let rowKey: string;
        if (rowColumn.dataType === "OptionSet" || rowColumn.dataType === "TwoOptions" || 
            rowColumn.dataType === "MultiSelectOptionSet") {
            rowKey = record.getFormattedValue(config.groupByRow) || "(Blank)";
        } else {
            const rawValue = record.getValue(config.groupByRow);
            rowKey = rawValue !== null && rawValue !== undefined ? String(rawValue) : "(Blank)";
        }

        // Get column key (use formatted value for OptionSets, raw value for others)
        let columnKey: string;
        if (columnColumn.dataType === "OptionSet" || columnColumn.dataType === "TwoOptions" || 
            columnColumn.dataType === "MultiSelectOptionSet") {
            columnKey = record.getFormattedValue(config.groupByColumn) || "(Blank)";
        } else {
            const rawValue = record.getValue(config.groupByColumn);
            columnKey = rawValue !== null && rawValue !== undefined ? String(rawValue) : "(Blank)";
        }

        // Get value for aggregation
        const rawValue = record.getValue(config.valueField);
        
        // Skip null/undefined values for aggregation (except for COUNT)
        if (rawValue === null || rawValue === undefined) {
            if (config.aggregationType === 'COUNT') {
                // For COUNT, we still count the record even if value is null
                rowSet.add(rowKey);
                columnSet.add(columnKey);
                
                const cellKey = `${rowKey}_|_${columnKey}`;
                const cellData = cellDataMap.get(cellKey) || { values: [], count: 0 };
                cellData.count++;
                cellDataMap.set(cellKey, cellData);
            }
            return;
        }

        rowSet.add(rowKey);
        columnSet.add(columnKey);

        // Convert value to number for aggregation
        let numericValue: number;
        if (isDateField) {
            // Handle date fields - PCF may return Date objects or ISO strings
            let dateValue: Date;
            if (rawValue instanceof Date) {
                dateValue = rawValue;
            } else if (typeof rawValue === 'string') {
                dateValue = new Date(rawValue);
            } else if (typeof rawValue === 'number') {
                dateValue = new Date(rawValue);
            } else {
                // Fallback: try to convert to string first, then to date
                dateValue = new Date(String(rawValue));
            }
            numericValue = dateValue.getTime();
        } else {
            numericValue = Number(rawValue);
        }

        // Store value in cell data
        const cellKey = `${rowKey}_|_${columnKey}`;
        const cellData = cellDataMap.get(cellKey) || { values: [], count: 0 };
        cellData.values.push(numericValue);
        cellData.count++;
        cellDataMap.set(cellKey, cellData);
    });

    // Calculate aggregates
    const gridData = new Map<string, number>();
    cellDataMap.forEach((cellData, cellKey) => {
        let aggregatedValue: number | undefined;

        switch (config.aggregationType) {
            case 'COUNT':
                aggregatedValue = cellData.count;
                break;
            
            case 'SUM':
                aggregatedValue = cellData.values.reduce((sum, val) => sum + val, 0);
                break;
            
            case 'AVG':
                // Only calculate average if we have values (exclude undefined/null)
                // Zero values ARE included in the average
                if (cellData.values.length === 0) {
                    // Don't add this cell to gridData - no valid values
                    aggregatedValue = undefined;
                } else {
                    const sum = cellData.values.reduce((sum, val) => sum + val, 0);
                    aggregatedValue = sum / cellData.values.length;
                }
                break;
            
            case 'MIN':
                aggregatedValue = cellData.values.length > 0 ? Math.min(...cellData.values) : undefined;
                break;
            
            case 'MAX':
                aggregatedValue = cellData.values.length > 0 ? Math.max(...cellData.values) : undefined;
                break;
            
            default:
                aggregatedValue = 0;
                break;
        }

        // Only add to gridData if we have a valid aggregated value
        if (aggregatedValue !== undefined) {
            gridData.set(cellKey, aggregatedValue);
        }
    });

    // Sort keys using smart comparison (handles numbers and text)
    const smartSort = (a: string, b: string): number => {
        const aNum = Number(a);
        const bNum = Number(b);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
        }
        
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    };

    const rowKeys = Array.from(rowSet).sort(smartSort);
    const columnKeys = Array.from(columnSet).sort(smartSort);

    return {
        rowKeys,
        columnKeys,
        gridData
    };
}

// ============================================================================
// REACT COMPONENT
// ============================================================================

interface IPivotTableProps {
    pivotData: IPivotData;
    valueColumn: ComponentFramework.PropertyHelper.DataSetApi.Column;
    aggregationType: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT';
    showTotals: boolean;
    showTitle: boolean;
    titleText: string;
}

interface IPivotRow {
    rowKey: string;
    rowTotal?: number;
    [key: string]: string | number | undefined;
}

/**
 * Format a numeric value based on column data type and aggregation type
 * Formatting rules:
 * - COUNT: Always whole numbers
 * - SUM: Preserves source format (whole->whole, decimal->decimal, currency->currency)
 * - AVG: Whole->decimal, others preserve format
 * - MIN/MAX: Preserves source format including dates
 */
function formatValue(value: number, dataType: string, aggregationType: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT'): string {
    // COUNT always returns whole numbers regardless of source type
    if (aggregationType === 'COUNT') {
        return new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 0
        }).format(value);
    }
    
    // AVERAGE on Whole Number fields returns Decimal format (not whole)
    if (aggregationType === 'AVG' && dataType === "Whole.None") {
        return new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    // For all other cases, format based on source data type
    if (dataType === "Currency") {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    } else if (dataType === "Decimal" || dataType === "FP") {
        return new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    } else if (dataType === "Whole.None") {
        return new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 0
        }).format(value);
    } else if (dataType === "DateAndTime.DateOnly" || dataType === "DateAndTime.DateAndTime") {
        // Value is stored as milliseconds timestamp, convert back to Date for display
        // Using toLocaleDateString for both date-only and datetime fields per requirements
        const dateObj = new Date(value);
        return dateObj.toLocaleDateString(undefined);
    }
    return String(value);
}

const PivotTable: React.FC<IPivotTableProps> = ({ pivotData, valueColumn, aggregationType, showTotals, showTitle, titleText }) => {
    const { rowKeys, columnKeys, gridData } = pivotData;

    // Calculate totals
    const columnTotals = new Map<string, number>();
    const rowTotals = new Map<string, number>();
    
    // Calculate column width for even distribution
    const totalColumns = columnKeys.length + 1 + (showTotals ? 1 : 0); // +1 for row header column
    const columnWidth = Math.max(100, Math.floor((100 / totalColumns)));
    
    // Calculate column totals and row totals
    columnKeys.forEach(colKey => {
        let colTotal = 0;
        let colCount = 0;
        rowKeys.forEach(rowKey => {
            const cellKey = `${rowKey}_|_${colKey}`;
            const value = gridData.get(cellKey);
            if (value !== undefined) {
                if (aggregationType === 'COUNT') {
                    colTotal += value;
                    colCount++;
                } else if (aggregationType === 'SUM' || aggregationType === 'AVG') {
                    colTotal += value;
                    colCount++;
                } else if (aggregationType === 'MIN') {
                    colTotal = colCount === 0 ? value : Math.min(colTotal, value);
                    colCount++;
                } else if (aggregationType === 'MAX') {
                    colTotal = colCount === 0 ? value : Math.max(colTotal, value);
                    colCount++;
                }
            }
        });
        // Only store total if we have valid values
        if (colCount > 0) {
            if (aggregationType === 'AVG') {
                colTotal = colTotal / colCount;
            }
            columnTotals.set(colKey, colTotal);
        } else if (aggregationType === 'COUNT' || aggregationType === 'SUM') {
            // For COUNT and SUM with no values, store 0
            columnTotals.set(colKey, 0);
        }
        // For MIN/MAX with no values, don't store anything (cell will be blank)
    });
    
    rowKeys.forEach(rowKey => {
        let rowTotal = 0;
        let rowCount = 0;
        columnKeys.forEach(colKey => {
            const cellKey = `${rowKey}_|_${colKey}`;
            const value = gridData.get(cellKey);
            if (value !== undefined) {
                if (aggregationType === 'COUNT') {
                    rowTotal += value;
                    rowCount++;
                } else if (aggregationType === 'SUM' || aggregationType === 'AVG') {
                    rowTotal += value;
                    rowCount++;
                } else if (aggregationType === 'MIN') {
                    rowTotal = rowCount === 0 ? value : Math.min(rowTotal, value);
                    rowCount++;
                } else if (aggregationType === 'MAX') {
                    rowTotal = rowCount === 0 ? value : Math.max(rowTotal, value);
                    rowCount++;
                }
            }
        });
        // Only store total if we have valid values
        if (rowCount > 0) {
            if (aggregationType === 'AVG') {
                rowTotal = rowTotal / rowCount;
            }
            rowTotals.set(rowKey, rowTotal);
        } else if (aggregationType === 'COUNT' || aggregationType === 'SUM') {
            // For COUNT and SUM with no values, store 0
            rowTotals.set(rowKey, 0);
        }
        // For MIN/MAX with no values, don't store anything (cell will be blank)
    });

    // Build columns for DetailsList
    const columns: IColumn[] = [
        {
            key: 'rowHeader',
            name: '',
            fieldName: 'rowKey',
            minWidth: 150,
            isResizable: true,
            isRowHeader: true,
            data: 'string',
            onRender: (item: IPivotRow) => {
                return React.createElement(
                    Text,
                    { 
                        variant: "medium", 
                        style: { 
                            fontWeight: item.rowKey === 'TOTAL' ? 700 : 600,
                            textAlign: 'center',
                            display: 'block'
                        } 
                    },
                    item.rowKey
                );
            }
        },
        ...columnKeys.map((colKey, index) => ({
            key: `col_${index}`,
            name: colKey,
            fieldName: colKey,
            minWidth: columnWidth,
            isResizable: true,
            data: 'number',
            styles: {
                root: { textAlign: 'center' },
                cellTitle: { textAlign: 'center', justifyContent: 'center' }
            },
            onRender: (item: IPivotRow) => {
                const value = item[colKey];
                return React.createElement(
                    Text,
                    { 
                        variant: "medium", 
                        style: { 
                            textAlign: 'center', 
                            display: 'block',
                            fontWeight: item.rowKey === 'TOTAL' ? 700 : 400
                        } 
                    },
                    value !== undefined && value !== null && typeof value === 'number'
                        ? formatValue(value, valueColumn.dataType, aggregationType)
                        : '-'
                );
            }
        })),
        ...(showTotals ? [{
            key: 'rowTotal',
            name: 'TOTAL',
            fieldName: 'rowTotal',
            minWidth: columnWidth,
            isResizable: true,
            data: 'number',
            styles: {
                root: { textAlign: 'center' },
                cellTitle: { textAlign: 'center', justifyContent: 'center' }
            },
            onRender: (item: IPivotRow) => {
                const value = item.rowTotal;
                return React.createElement(
                    Text,
                    { 
                        variant: "medium", 
                        style: { 
                            textAlign: 'center', 
                            display: 'block',
                            fontWeight: 700
                        } 
                    },
                    value !== undefined && value !== null && typeof value === 'number'
                        ? formatValue(value, valueColumn.dataType, aggregationType)
                        : '-'
                );
            }
        }] : [])
    ];

    // Build rows for DetailsList
    const rows: IPivotRow[] = rowKeys.map(rowKey => {
        const row: IPivotRow = { rowKey };
        
        columnKeys.forEach(colKey => {
            const cellKey = `${rowKey}_|_${colKey}`;
            const value = gridData.get(cellKey);
            row[colKey] = value; // Keep as undefined if no value
        });
        
        row.rowTotal = rowTotals.get(rowKey); // Keep as undefined if no total
        
        return row;
    });
    
    // Add total row if enabled
    if (showTotals) {
        const totalRow: IPivotRow = { rowKey: 'TOTAL' };
        columnKeys.forEach(colKey => {
            totalRow[colKey] = columnTotals.get(colKey); // Keep as undefined if no total
        });
        
        // Calculate grand total
        let grandTotal = 0;
        let grandCount = 0;
        rowKeys.forEach(rowKey => {
            const rowTotal = rowTotals.get(rowKey);
            if (rowTotal !== undefined) {
                if (aggregationType === 'COUNT' || aggregationType === 'SUM') {
                    grandTotal += rowTotal;
                    grandCount++;
                } else if (aggregationType === 'AVG') {
                    grandTotal += rowTotal;
                    grandCount++;
                } else if (aggregationType === 'MIN') {
                    grandTotal = grandCount === 0 ? rowTotal : Math.min(grandTotal, rowTotal);
                    grandCount++;
                } else if (aggregationType === 'MAX') {
                    grandTotal = grandCount === 0 ? rowTotal : Math.max(grandTotal, rowTotal);
                    grandCount++;
                }
            }
        });
        if (aggregationType === 'AVG' && grandCount > 0) {
            grandTotal = grandTotal / grandCount;
        }
        // Only set grand total if we have valid values
        if (grandCount > 0) {
            totalRow.rowTotal = grandTotal;
        } else if (aggregationType === 'COUNT' || aggregationType === 'SUM') {
            totalRow.rowTotal = 0;
        }
        // For MIN/MAX with no values, leave rowTotal as undefined
        
        rows.push(totalRow);
    }

    // Handle empty data
    if (rowKeys.length === 0 || columnKeys.length === 0) {
        return React.createElement(
            Stack,
            { horizontalAlign: "center", verticalAlign: "center", style: { padding: 20 } },
            React.createElement(Text, { variant: "large" }, "No data to display")
        );
    }

    return React.createElement(
        'div',
        { style: { width: '100%', height: '100%', overflow: 'auto' } },
        showTitle && React.createElement(
            'div',
            { className: 'matrix-title-container' },
            React.createElement('h2', { className: 'matrix-title' }, titleText),
            React.createElement('div', { className: 'matrix-title-accent' })
        ),
        React.createElement(DetailsList, {
            items: rows,
            columns: columns,
            layoutMode: DetailsListLayoutMode.fixedColumns,
            selectionMode: SelectionMode.none,
            isHeaderVisible: true,
            compact: false
        })
    );
};

// ============================================================================
// PCF CONTROL CLASS
// ============================================================================

export class CustomMatrixPCF implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _root: Root | undefined;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this._container = container;
        this._context = context;
        this._root = createRoot(container);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        
        if (!this._root) {
            return;
        }

        const dataset = context.parameters.sampleDataSet;
        
        // Check if dataset is loaded
        if (!dataset || !dataset.columns || dataset.columns.length === 0) {
            this._root.render(
                React.createElement(Stack, { 
                    horizontalAlign: "center", 
                    verticalAlign: "center", 
                    style: { padding: 20 } 
                },
                    React.createElement(Text, { variant: "large" }, "Dataset not configured")
                )
            );
            return;
        }

        if (!dataset.sortedRecordIds || dataset.sortedRecordIds.length === 0) {
            this._root.render(
                React.createElement(Stack, { 
                    horizontalAlign: "center", 
                    verticalAlign: "center", 
                    style: { padding: 20 } 
                },
                    React.createElement(Text, { variant: "large" }, "No records to display")
                )
            );
            return;
        }

        // Get configuration from input properties
        const groupByRow = context.parameters.groupByRow.raw || "";
        const groupByColumn = context.parameters.groupByColumn.raw || "";
        const valueField = context.parameters.valueField.raw || "";
        const aggregationTypeValue = context.parameters.aggregationType.raw;
        
        // Map enum value to aggregation type
        const aggregationTypeMap: Record<string, 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'> = {
            '0': 'COUNT',
            '1': 'SUM',
            '2': 'AVG',
            '3': 'MIN',
            '4': 'MAX'
        };
        
        const showTotals = context.parameters.showTotals.raw !== false;
        const showTitle = context.parameters.showTitle.raw !== false;
        
        const config: IPivotConfig = {
            groupByRow,
            groupByColumn,
            valueField,
            aggregationType: aggregationTypeMap[aggregationTypeValue] || 'COUNT'
        };

        try {
            // Transform dataset to pivot structure
            const pivotData = transformDatasetToPivot(dataset, config);
            
            // Get value column for formatting
            const valueColumn = dataset.columns.find(col => col.name === config.valueField);
            
            if (!valueColumn) {
                throw new Error(`Value field '${config.valueField}' not found in dataset columns`);
            }
            
            // Get columns for title generation
            const rowColumn = dataset.columns.find(col => col.name === config.groupByRow);
            const columnColumn = dataset.columns.find(col => col.name === config.groupByColumn);
            
            // Generate title text
            const aggregationDisplayNames: Record<string, string> = {
                'COUNT': 'Count',
                'SUM': 'Sum',
                'AVG': 'Average',
                'MIN': 'Minimum',
                'MAX': 'Maximum'
            };
            
            // Get the entity display name from the dataset
            // The entity reference name contains the plural display name
            let tableDisplayName = 'Records';
            if ((dataset as any).getEntityReferenceName) {
                tableDisplayName = (dataset as any).getEntityReferenceName();
            } else if (dataset.getTargetEntityType) {
                const entityType = dataset.getTargetEntityType();
                // Format the logical name (e.g., "contact" -> "Contacts")
                if (entityType) {
                    tableDisplayName = entityType.charAt(0).toUpperCase() + entityType.slice(1) + 's';
                }
            }
            
            const aggregationDisplay = aggregationDisplayNames[config.aggregationType] || config.aggregationType;
            const valueFieldDisplay = valueColumn.displayName || config.valueField;
            const rowFieldDisplay = rowColumn?.displayName || config.groupByRow;
            const columnFieldDisplay = columnColumn?.displayName || config.groupByColumn;
            
            const titleText = `${tableDisplayName}: ${aggregationDisplay} of ${valueFieldDisplay} by ${rowFieldDisplay} and ${columnFieldDisplay}`;
            
            // Render React component
            this._root.render(
                React.createElement(PivotTable, { 
                    pivotData,
                    valueColumn,
                    aggregationType: config.aggregationType,
                    showTotals,
                    showTitle,
                    titleText
                })
            );
        } catch (error) {
            // Display error message
            this._root.render(
                React.createElement(Stack, { 
                    horizontalAlign: "center", 
                    verticalAlign: "center", 
                    style: { padding: 20 } 
                },
                    React.createElement(Text, { 
                        variant: "large", 
                        style: { color: '#a4262c' } 
                    }, `Error: ${error instanceof Error ? error.message : String(error)}`)
                )
            );
        }
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        if (this._root) {
            this._root.unmount();
        }
    }
}
