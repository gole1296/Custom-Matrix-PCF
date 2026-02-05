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
        if (isDateField && rawValue instanceof Date) {
            numericValue = rawValue.getTime();
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
        let aggregatedValue: number;

        switch (config.aggregationType) {
            case 'COUNT':
                aggregatedValue = cellData.count;
                break;
            
            case 'SUM':
                aggregatedValue = cellData.values.reduce((sum, val) => sum + val, 0);
                break;
            
            case 'AVG':
                if (cellData.values.length === 0) {
                    aggregatedValue = 0;
                } else {
                    const sum = cellData.values.reduce((sum, val) => sum + val, 0);
                    aggregatedValue = sum / cellData.values.length;
                }
                break;
            
            case 'MIN':
                aggregatedValue = Math.min(...cellData.values);
                break;
            
            case 'MAX':
                aggregatedValue = Math.max(...cellData.values);
                break;
            
            default:
                aggregatedValue = 0;
                break;
        }

        gridData.set(cellKey, aggregatedValue);
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
}

interface IPivotRow {
    rowKey: string;
    [key: string]: string | number;
}

const PivotTable: React.FC<IPivotTableProps> = ({ pivotData }) => {
    const { rowKeys, columnKeys, gridData } = pivotData;

    // Build columns for DetailsList
    const columns: IColumn[] = [
        {
            key: 'rowHeader',
            name: '',
            fieldName: 'rowKey',
            minWidth: 150,
            maxWidth: 250,
            isResizable: true,
            isRowHeader: true,
            data: 'string',
            onRender: (item: IPivotRow) => {
                return React.createElement(
                    Text,
                    { variant: "medium", style: { fontWeight: 600 } },
                    item.rowKey
                );
            }
        },
        ...columnKeys.map((colKey, index) => ({
            key: `col_${index}`,
            name: colKey,
            fieldName: colKey,
            minWidth: 100,
            maxWidth: 150,
            isResizable: true,
            data: 'number',
            onRender: (item: IPivotRow) => {
                const value = item[colKey];
                return React.createElement(
                    Text,
                    { variant: "medium", style: { textAlign: 'right', display: 'block' } },
                    value !== undefined && value !== null ? value : '-'
                );
            }
        }))
    ];

    // Build rows for DetailsList
    const rows: IPivotRow[] = rowKeys.map(rowKey => {
        const row: IPivotRow = { rowKey };
        
        columnKeys.forEach(colKey => {
            const cellKey = `${rowKey}_|_${colKey}`;
            const value = gridData.get(cellKey);
            row[colKey] = value !== undefined ? value : 0;
        });
        
        return row;
    });

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
        React.createElement(DetailsList, {
            items: rows,
            columns: columns,
            layoutMode: DetailsListLayoutMode.justified,
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
        
        const config: IPivotConfig = {
            groupByRow,
            groupByColumn,
            valueField,
            aggregationType: aggregationTypeMap[aggregationTypeValue] || 'COUNT'
        };

        try {
            // Transform dataset to pivot structure
            const pivotData = transformDatasetToPivot(dataset, config);
            
            // Render React component
            this._root.render(
                React.createElement(PivotTable, { pivotData })
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
