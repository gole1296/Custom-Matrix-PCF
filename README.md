# Custom Matrix PCF Control

A powerful pivot table/matrix control for Power Platform subgrids that enables dynamic data aggregation and visualization directly within model-driven apps.

## Overview

The Custom Matrix PCF control transforms standard subgrid data into interactive matrix visualizations, allowing users to analyze data across two dimensions with various aggregation methods. Perfect for dashboards, reports, and data analysis scenarios where you need to see patterns and relationships in your data.

### Key Features

- **Multi-dimensional Analysis**: Group data by two fields (rows and columns) simultaneously
- **Flexible Aggregations**: Support for Count, Sum, Average, Minimum, and Maximum
- **Auto-calculated Totals**: Optional row and column totals with grand total
- **Dynamic Titles**: Automatically generated descriptive titles with accent bar styling
- **Smart Formatting**: Automatic formatting based on field data types (currency, decimals, dates, etc.)
- **Fluent UI Integration**: Native Microsoft design system for seamless app integration

## Installation

### Prerequisites

- Power Platform environment with maker permissions
- Power Apps Component Framework (PCF) enabled in your environment
- Access to create and modify solutions

### Deployment Steps

1. **Download the Solution**
   - Download the latest managed or unmanaged solution package

2. **Import to Your Environment**
   ```powershell
   pac solution import --path [path-to-solution-file]
   ```
   Or use the Power Platform admin center to import manually

3. **Enable the Control**
   - Navigate to Settings → Administration → System Settings
   - Under the "Previews" tab, ensure PCF controls are enabled

## Configuration

### Adding to a Subgrid

1. Open your model-driven app in the form designer
2. Select the subgrid control you want to convert
3. Click "Add component" or replace the existing control
4. Select "Custom Matrix PCF" from the list
5. Configure the required properties (see below)

### Required Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| **Row Field** | Text | Logical name of the field to use for row headers | `statuscode` |
| **Column Field** | Text | Logical name of the field to use for column headers | `new_fiscalyear` |
| **Value Field** | Text | Logical name of the field to aggregate in cells | `estimatedvalue` |
| **Aggregation Type** | Enum | Type of aggregation to perform | Sum, Count, Average, Min, Max |

### Optional Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| **Show Totals** | Yes/No | Yes | Display total row and column with grand total |
| **Show Title** | Yes/No | Yes | Display auto-generated title with accent bar |

### Property Configuration Examples

**Example 1: Revenue by Status and Year**
- Row Field: `statuscode`
- Column Field: `new_estimatedcloseyear`
- Value Field: `estimatedvalue`
- Aggregation Type: `Sum`

**Example 2: Case Volume by Priority**
- Row Field: `prioritycode`
- Column Field: `statuscode`
- Value Field: `createdon`
- Aggregation Type: `Count`

**Example 3: Average Deal Size**
- Row Field: `new_salesregion`
- Column Field: `new_productype`
- Value Field: `estimatedvalue`
- Aggregation Type: `Average`

## Field Type Support

### Supported for Row/Column Headers

- ✅ **Text Fields**: Single Line of Text, Multiple Lines of Text
- ✅ **Option Sets**: Single-select option sets
- ✅ **Two Options**: Yes/No fields
- ✅ **Whole Numbers**: Integer fields
- ✅ **Date/Time**: Date fields (formatted as dates)
- ❌ **Lookup Fields**: Not supported (will display error)

### Supported for Value Fields (Aggregation)

| Aggregation | Supported Field Types |
|-------------|----------------------|
| **Count** | All field types (counts records regardless of value) |
| **Sum** | Whole Number, Decimal, Currency, Floating Point |
| **Average** | Whole Number, Decimal, Currency, Floating Point |
| **Minimum** | Whole Number, Decimal, Currency, Floating Point, Date/Time |
| **Maximum** | Whole Number, Decimal, Currency, Floating Point, Date/Time |

## Automatic Title Generation

When "Show Title" is enabled, the control automatically generates a descriptive title in the format:

```
{Entity Name}: {Aggregation} of {Value Field} by {Row Field} and {Column Field}
```

### Examples

- "Opportunities: Sum of Est. Revenue by Status and Estimated Close Year"
- "Cases: Count of Created On by Priority and Status"
- "Contacts: Minimum of Created on Date by Job Title and Preferred Method of Contact"

The title includes a blue accent bar below it for visual emphasis.

## Data Formatting

The control intelligently formats values based on the source field's data type:

- **Currency**: Formatted with currency symbol and 2 decimal places (e.g., $1,234.56)
- **Decimal/Floating Point**: Formatted with 2 decimal places (e.g., 123.45)
- **Whole Numbers**: No decimal places (e.g., 1,234)
- **Dates**: Formatted using locale-specific date format
- **Count Aggregations**: Always displayed as whole numbers

### Special Formatting Rules

- **Average of Whole Numbers**: Displayed as decimals (e.g., 23.45)
- **Average of Decimals**: Maintains 2 decimal places
- **Minimum/Maximum of Dates**: Displayed as formatted dates
- **Blank Values**: Displayed as "-" in cells with no data

## Limitations & Considerations

### Field Limitations

1. **Lookup Fields Cannot Be Used for Grouping**
   - Lookup fields (Simple, Customer, Owner, PartyList, Regarding) are not supported for row or column headers
   - Error message will display if attempted
   - **Workaround**: Use a text field that copies the lookup's display value

2. **Data Type Restrictions**
   - Sum and Average require numeric or currency fields
   - Min and Max require numeric, currency, or date fields
   - The control validates field types and displays helpful error messages

### Performance Considerations

1. **Record Count**
   - Best performance with subgrids containing up to 5,000 records
   - Larger datasets may experience slower rendering
   - Consider applying view filters to limit data

2. **Matrix Size**
   - Optimal display with 10-20 unique values per dimension
   - Very large matrices (e.g., 100x100) may require horizontal scrolling

3. **Aggregation Operations**
   - All calculations are performed client-side in the browser
   - Complex aggregations on large datasets may have processing delay

### Data Accuracy

1. **Null Value Handling**
   - Count aggregations include records even if the value field is null
   - Sum, Average, Min, Max exclude null values from calculations
   - Cells with no matching records display "-"

2. **Blank vs. Zero**
   - Zero values are included in all calculations
   - "(Blank)" label appears for null row/column grouping values

3. **Date Aggregations**
   - Min/Max on dates works by converting to timestamps internally
   - All dates displayed using browser's locale settings

### View and Filter Dependencies

1. **View Configuration**
   - The control respects the subgrid's underlying view
   - All required fields (row, column, value) must be in the view's columns
   - View filters are applied before the matrix is generated

2. **Permissions**
   - Users only see data they have read permissions for
   - Matrix reflects security roles and record ownership rules

## Styling & Appearance

The control uses Fluent UI components and follows Microsoft's design system:

- **Header Row/Column**: Light gray background (#f3f2f1) with medium weight font
- **Data Cells**: White background with standard weight font
- **Total Row/Column**: White background with bold font
- **Title**: 18px, semi-bold with 3px blue accent bar (#0078d4)
- **Borders**: Subtle borders (#edebe9) between all cells
- **Responsive**: Automatically adjusts column width based on available space

## Troubleshooting

### Common Issues

**Error: "Row field 'fieldname' is a Lookup field, which is not supported"**
- Solution: Choose a non-lookup field for grouping

**Error: "Aggregation type 'Sum' requires a numeric or currency field"**
- Solution: Select a compatible aggregation type or change the value field

**Matrix shows "No records to display"**
- Check that the subgrid view has records
- Verify the view includes all required fields
- Check user permissions on the records

**Title shows wrong entity name**
- The control uses the entity's logical name, capitalized
- This is derived from the dataset's target entity type

**Columns are too narrow or too wide**
- Column width auto-adjusts based on number of columns
- For many columns, horizontal scrolling is enabled
- Columns are resizable by dragging the header borders

## Development

### Building from Source

```powershell
# Clone the repository
git clone [repository-url]

# Install dependencies
npm install

# Build the control
npm run build

# Test locally
npm start watch
```

### Running Tests

```powershell
# Push to test environment
pac pcf push --publisher-prefix [your-prefix]
```

## Version History

### Version 0.1.0
- Initial release
- Multi-dimensional pivot table functionality
- Support for 5 aggregation types (Count, Sum, Average, Min, Max)
- Auto-calculated row and column totals
- Smart data type formatting
- Dynamic title generation with accent bar
- Configurable title and totals display

## Support & Feedback

For issues, questions, or feature requests, please contact the development team or submit an issue in the repository.

## License

[Specify your license here]

## Credits

Developed by EightyThirtyFive Solutions  
Built with Power Apps Component Framework and Fluent UI React

---

**Note**: This control is designed for model-driven Power Apps and requires the Power Apps Component Framework to be enabled in your environment.
